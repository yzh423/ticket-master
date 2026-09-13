import { describe, expect, it } from 'vitest';
import {
  createEventMutationQueue,
  mergeRuleEdit,
  removeSaleKeepingResults,
} from './event-mutation';
import { defaultChecklist, type EventRecord } from '../shared/model';

describe('任务并发编辑', () => {
  it('连续勾选两项准备工作时保留两次修改', async () => {
    let current = {
      id: 'event-1',
      checklist: defaultChecklist(),
    } as EventRecord;
    const queue = createEventMutationQueue({
      list: async () => [current],
      save: async (event) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        current = event;
        return event;
      },
    });
    await Promise.all([
      queue('event-1', (event) => ({
        ...event,
        checklist: { ...event.checklist, account: true },
      })),
      queue('event-1', (event) => ({
        ...event,
        checklist: { ...event.checklist, identity: true },
      })),
    ]);
    expect(current.checklist.account).toBe(true);
    expect(current.checklist.identity).toBe(true);
  });

  it('一次保存失败后仍能保存后续修改', async () => {
    let current = { id: 'event-1', checklist: defaultChecklist() } as EventRecord;
    let failNext = true;
    const queue = createEventMutationQueue({
      list: async () => [current],
      save: async (event) => {
        if (failNext) {
          failNext = false;
          throw new Error('磁盘暂时不可写');
        }
        current = event;
        return event;
      },
    });
    await expect(queue('event-1', (event) => event)).rejects.toThrow('磁盘暂时不可写');
    await queue('event-1', (event) => ({
      ...event,
      checklist: { ...event.checklist, account: true },
    }));
    expect(current.checklist.account).toBe(true);
  });

  it('删除销售机会时保留已有结果并解除失效关联', () => {
    const event = {
      opportunities: [{ id: 'sale-1' }, { id: 'sale-2' }],
      attempts: [
        { id: 'attempt-1', opportunityId: 'sale-1' },
        { id: 'attempt-2', opportunityId: 'sale-2' },
      ],
    } as EventRecord;
    const next = removeSaleKeepingResults(event, 'sale-1');
    expect(next.opportunities.map((item) => item.id)).toEqual(['sale-2']);
    expect(next.attempts.map((item) => item.opportunityId)).toEqual([null, 'sale-2']);
  });

  it('编辑规则时保留期间新增的清单、机会与结果', () => {
    const current = {
      id: 'event-1',
      createdAt: '2026-01-01',
      sessionAt: '2026-10-01T00:00:00.000Z',
      followUntil: '2026-09-30T00:00:00.000Z',
      checklist: { ...defaultChecklist(), account: true },
      opportunities: [{ id: 'new-sale' }],
      attempts: [{ id: 'new-result' }],
    } as EventRecord;
    const edited = {
      ...current,
      title: '新活动名',
      createdAt: 'wrong',
      checklist: { ...defaultChecklist(), account: false },
      opportunities: [],
      attempts: [],
    } as EventRecord;
    const merged = mergeRuleEdit(current, edited);
    expect(merged.title).toBe('新活动名');
    expect(merged.createdAt).toBe('2026-01-01');
    expect(merged.checklist.account).toBe(true);
    expect(merged.opportunities).toHaveLength(1);
    expect(merged.attempts).toHaveLength(1);
  });
});
