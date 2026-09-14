import type { EventRecord } from '../shared/model';
import { lastPerformanceAt } from '../shared/rules';

type EventStorage = Pick<Window['ticket'], 'list' | 'save'>;

export function createEventMutationQueue(storage: EventStorage) {
  let tail: Promise<unknown> = Promise.resolve();
  return (eventId: string, update: (current: EventRecord) => EventRecord): Promise<EventRecord> => {
    const operation = tail.then(async () => {
      const current = (await storage.list()).find((item) => item.id === eventId);
      if (!current) throw new Error('任务已不存在，请返回列表重新选择');
      return storage.save(update(current));
    });
    tail = operation.catch(() => {});
    return operation;
  };
}

export function removeSaleKeepingResults(event: EventRecord, saleId: string): EventRecord {
  return {
    ...event,
    opportunities: event.opportunities.filter((item) => item.id !== saleId),
    attempts: event.attempts.map((item) =>
      item.opportunityId === saleId ? { ...item, opportunityId: null } : item,
    ),
  };
}

export function mergeRuleEdit(current: EventRecord, edited: EventRecord): EventRecord {
  return {
    ...edited,
    createdAt: current.createdAt,
    opportunities: current.opportunities,
    checklist: current.checklist,
    attempts: current.attempts,
    followUntil:
      Date.parse(current.followUntil) > Date.parse(lastPerformanceAt(edited))
        ? lastPerformanceAt(edited)
        : current.followUntil,
  };
}
