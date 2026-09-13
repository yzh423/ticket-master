import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { unlinkSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TicketStore } from './store';
import { defaultChecklist, type EventRecord } from '../shared/model';

const file = join(tmpdir(), `ticket-window-test-${randomUUID()}.sqlite`);
afterEach(() => {
  if (existsSync(file)) unlinkSync(file);
  if (existsSync(`${file}.bak`)) unlinkSync(`${file}.bak`);
  if (existsSync(`${file}.tmp`)) unlinkSync(`${file}.tmp`);
  if (existsSync(`${file}.bak.tmp`)) unlinkSync(`${file}.bak.tmp`);
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

it('主库损坏时从本地备份恢复任务，避免空库覆盖已有记录', async () => {
  const first = await TicketStore.open(file);
  first.save(event);
  first.close();
  expect(existsSync(`${file}.bak`)).toBe(true);
  writeFileSync(file, 'corrupted database');
  const recovered = await TicketStore.open(file);
  expect(recovered.list()).toEqual([event]);
  expect(recovered.recoveredFromBackup).toBe(true);
  recovered.close();
});

it('通知窗口同一个机会只记录一次，变更开售时间可重新提醒', async () => {
  const store = await TicketStore.open(file);
  expect(store.hasReminder('sale-id', '2026-10-01T11:00:00.000Z', '5m')).toBe(false);
  expect(store.markReminder('sale-id', '2026-10-01T11:00:00.000Z', '5m')).toBe(true);
  expect(store.hasReminder('sale-id', '2026-10-01T11:00:00.000Z', '5m')).toBe(true);
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

it('拒绝早于记录时间的支付截止，避免发出误导提醒', async () => {
  const store = await TicketStore.open(file);
  expect(() =>
    store.save({
      ...event,
      attempts: [
        {
          id: randomUUID(),
          at: '2026-09-14T10:00:00.000Z',
          opportunityId: null,
          status: 'pending_payment',
          paymentDeadline: '2026-09-14T09:59:00.000Z',
          tier: '看台',
          total: null,
          evidence: '官方订单页',
          note: '',
        },
      ],
    }),
  ).toThrow('支付截止时间必须晚于记录时间');
  store.close();
});

it('拒绝无效公告来源和重复的销售机会 ID，避免提醒串到另一条机会', async () => {
  const store = await TicketStore.open(file);
  expect(() => store.save({ ...event, sourceUrl: '不是网址' })).toThrow();
  const sale = {
    id: 'sale-1',
    type: 'public' as const,
    localTime: '2026-09-20T12:00',
    timeZone: 'Asia/Shanghai',
    startsAt: '2026-09-20T04:00:00.000Z',
    endsAt: null,
    eligibility: '',
    url: '',
    sourceUrl: event.sourceUrl,
    verifiedAt: '2026-09-14',
    status: 'planned' as const,
    note: '',
  };
  expect(() => store.save({ ...event, opportunities: [sale, { ...sale }] })).toThrow();
  store.close();
});
