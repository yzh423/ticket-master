import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TicketStore } from './store';
import { defaultChecklist, type EventRecord } from '../shared/model';

const file = join(tmpdir(), `ticket-window-test-${randomUUID()}.sqlite`);
afterEach(() => {
  if (existsSync(file)) unlinkSync(file);
});
const event: EventRecord = {
  id: randomUUID(),
  title: '测试演出',
  platform: 'damai',
  venue: '上海',
  sessionLocal: '2026-10-01T19:30',
  timeZone: 'Asia/Shanghai',
  sessionAt: '2026-10-01T11:30:00.000Z',
  currency: 'CNY',
  quantity: 2,
  budget: 1200,
  owner: '本人',
  tiers: [{ label: '看台', unitPrice: 580 }],
  eventUrl: 'https://detail.damai.cn/item.htm?id=1',
  sourceUrl: 'https://detail.damai.cn/item.htm?id=1',
  verifiedAt: '2026-09-14',
  ruleNote: '',
  opportunities: [],
  checklist: defaultChecklist(),
  attempts: [],
  followUntil: '2026-10-01T11:30:00.000Z',
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
};

it('将任务保存在本地 SQLite，重启后可读且不会遗失人工结果', async () => {
  const first = await TicketStore.open(file);
  first.save(event);
  first.close();
  const second = await TicketStore.open(file);
  expect(second.list()).toEqual([event]);
  second.close();
});

it('通知窗口同一个机会只记录一次，变更开售时间可重新提醒', async () => {
  const store = await TicketStore.open(file);
  expect(store.markReminder('sale-id', '2026-10-01T11:00:00.000Z', '5m')).toBe(true);
  expect(store.markReminder('sale-id', '2026-10-01T11:00:00.000Z', '5m')).toBe(false);
  expect(store.markReminder('sale-id', '2026-10-01T12:00:00.000Z', '5m')).toBe(true);
  store.close();
});

it('不接受晚于演出时间的跟进期限', async () => {
  const store = await TicketStore.open(file);
  expect(() => store.save({ ...event, followUntil: '2026-10-02T00:00:00.000Z' })).toThrow();
  store.close();
});

it('已付款或已出票记录必须有人工确认依据', async () => {
  const store = await TicketStore.open(file);
  expect(() =>
    store.save({
      ...event,
      attempts: [
        {
          id: randomUUID(),
          at: '2026-09-14T00:00:00.000Z',
          opportunityId: null,
          status: 'issued',
          tier: '看台',
          total: 1160,
          evidence: '',
          note: '',
        },
      ],
    }),
  ).toThrow();
  store.close();
});
