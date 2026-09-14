import { describe, expect, it } from 'vitest';
import { defaultChecklist, type EventRecord, type SaleOpportunity } from './model';
import { planActions } from './action-plan';

const now = Date.parse('2026-09-14T08:00:00.000Z');
const sale: SaleOpportunity = {
  id: 'sale-1',
  type: 'public',
  localTime: '2026-09-20T12:00',
  timeZone: 'Asia/Shanghai',
  startsAt: '2026-09-20T04:00:00.000Z',
  endsAt: null,
  eligibility: '',
  url: 'https://www.damai.cn/',
  sourceUrl: 'https://www.damai.cn/',
  verifiedAt: '2026-09-14',
  status: 'planned',
  note: '',
};
const event: EventRecord = {
  id: 'event-1',
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
  eventUrl: 'https://www.damai.cn/',
  sourceUrl: 'https://www.damai.cn/',
  verifiedAt: '2026-09-14',
  ruleNote: '',
  opportunities: [sale],
  checklist: defaultChecklist(),
  attempts: [],
  followUntil: '2026-10-01T11:30:00.000Z',
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
};

describe('跨任务下一步', () => {
  it('待支付订单始终先于后续销售；超时只要求核对官方状态', () => {
    const order = {
      ...event,
      attempts: [
        {
          id: 'order-1',
          at: '2026-09-14T07:00:00.000Z',
          opportunityId: sale.id,
          status: 'pending_payment' as const,
          paymentDeadline: '2026-09-14T07:30:00.000Z',
          tier: '看台',
          total: 1160,
          evidence: '订单号后四位',
          note: '',
        },
      ],
    };
    const [action] = planActions([event, order], now);
    expect(action.kind).toBe('payment');
    expect(action.title).toContain('核对');
    expect(action.target).toBe('results');
  });

  it('没有录入来源明确的销售机会时提示补齐日历', () => {
    const [action] = planActions([{ ...event, opportunities: [] }], now);
    expect(action.kind).toBe('missing_sale');
    expect(action.target).toBe('sales');
  });

  it('优先购资格未核对时引导准备，不误称已获得资格', () => {
    const [action] = planActions(
      [{ ...event, opportunities: [{ ...sale, type: 'presale' }] }],
      now,
    );
    expect(action.kind).toBe('prepare');
    expect(action.detail).toContain('资格');
  });

  it('准备完成后仍提醒复核官方入口与当前公告', () => {
    const checklist = Object.fromEntries(
      Object.keys(defaultChecklist()).map((key) => [key, true]),
    ) as EventRecord['checklist'];
    const [action] = planActions([{ ...event, checklist }], now);
    expect(action.kind).toBe('review');
    expect(action.target).toBe('sales');
  });

  it('已出票或跟进期结束不产生新的抢票建议', () => {
    const issued = {
      ...event,
      attempts: [
        {
          id: 'order-1',
          at: '2026-09-14T07:00:00.000Z',
          opportunityId: sale.id,
          status: 'issued' as const,
          tier: '看台',
          total: 1160,
          evidence: '官方票夹',
          note: '',
        },
      ],
    };
    expect(planActions([issued], now)).toEqual([]);
    expect(planActions([{ ...event, followUntil: '2026-09-14T07:00:00.000Z' }], now)).toEqual([]);
  });
});
