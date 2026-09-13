import { describe, expect, it } from 'vitest';
import {
  chooseTier,
  parseLocalInstant,
  formatLocalInstant,
  remindersDue,
  validateEvent,
  officialUrl,
  hasOpenOrder,
  preparationGaps,
} from './rules';

const tiers = [
  { label: 'A 内场', unitPrice: 880 },
  { label: 'B 看台', unitPrice: 580 },
  { label: 'C 高层', unitPrice: 380 },
];

describe('票档决策', () => {
  it('公开销售不强制优先购资格，预售则提示补齐资格', () => {
    const checklist = {
      account: true,
      identity: true,
      attendees: true,
      qualification: false,
      payment: true,
      channel: true,
      network: true,
      notification: true,
    };
    expect(preparationGaps(checklist, 'public')).toEqual([]);
    expect(preparationGaps(checklist, 'presale')).toEqual(['qualification']);
  });
  it('按每个销售机会的最新结果判断是否已有订单，其他机会失败不取消待支付状态', () => {
    const pending = {
      id: 'a',
      opportunityId: 'sale-a',
      at: '2026-09-14T10:00:00Z',
      status: 'pending_payment',
    };
    const otherFailure = {
      id: 'b',
      opportunityId: 'sale-b',
      at: '2026-09-14T10:05:00Z',
      status: 'failed',
    };
    const sameFailure = {
      id: 'c',
      opportunityId: 'sale-a',
      at: '2026-09-14T10:10:00Z',
      status: 'failed',
    };
    expect(hasOpenOrder([pending, otherFailure] as never)).toBe(true);
    expect(hasOpenOrder([pending, otherFailure, sameFailure] as never)).toBe(false);
  });
  it('A 售罄时从可接受且可预算的票档中选 B，不改变人数', () => {
    expect(chooseTier(tiers, ['sold_out', 'available', 'available'], 2, 1200)).toMatchObject({
      kind: 'recommend',
      index: 1,
    });
  });
  it('加载未知不能被当成售罄，不能猜测手续费是否可预算', () => {
    expect(chooseTier(tiers, ['unknown', 'available', 'sold_out'], 2, 1200)).toMatchObject({
      kind: 'recommend',
      index: 1,
    });
    expect(chooseTier(tiers, ['unknown', 'sold_out', 'sold_out'], 2, 1000).kind).toBe('uncertain');
    expect(chooseTier([{ label: 'A', unitPrice: null }], ['available'], 1, 1000).kind).toBe(
      'check_total',
    );
  });
  it('订单总额超过预算的票档不得建议', () => {
    expect(chooseTier(tiers, ['available', 'sold_out', 'sold_out'], 2, 1000).kind).toBe(
      'over_budget',
    );
  });
});

describe('时间与提醒', () => {
  it('将场地本地时间转换为绝对时间，拒绝夏令时无效时间', () => {
    expect(parseLocalInstant('2026-09-14T20:00', 'Asia/Shanghai')).toBe('2026-09-14T12:00:00.000Z');
    expect(() => parseLocalInstant('2026-03-08T02:30', 'America/New_York')).toThrow();
    expect(formatLocalInstant('2026-10-01T11:00:00.000Z', 'Asia/Shanghai')).toBe(
      '2026-10-01T19:00',
    );
  });
  it('休眠错过精确分钟后仍提醒当前最紧迫的机会，但不补发过期提醒', () => {
    const at = '2026-09-14T12:00:00.000Z';
    expect(remindersDue(at, Date.parse(at) - 5 * 60_000 + 20_000, new Set())).toEqual(['5m']);
    expect(remindersDue(at, Date.parse(at) - 5 * 60_000 + 20_000, new Set(['5m']))).toEqual([]);
    expect(remindersDue(at, Date.parse(at) - 20 * 60_000, new Set())).toEqual(['30m']);
    expect(remindersDue(at, Date.parse(at) - 2 * 60_000, new Set())).toEqual(['5m']);
    expect(remindersDue(at, Date.parse(at) + 61_000, new Set())).toEqual(['now']);
    expect(remindersDue(at, Date.parse(at) + 11 * 60_000, new Set())).toEqual([]);
  });
});

describe('边界验证', () => {
  it('仅打开被识别平台的 HTTPS 官方域名', () => {
    expect(officialUrl('damai', 'https://detail.damai.cn/item.htm?id=1')).toBe(true);
    expect(officialUrl('damai', 'https://damai.cn.evil.example/item')).toBe(false);
    expect(officialUrl('damai', 'javascript:alert(1)')).toBe(false);
    expect(officialUrl('seatgeek', 'https://seatgeek.com/concert-tickets')).toBe(true);
    expect(officialUrl('seatgeek', 'https://seatgeek.com.evil.example')).toBe(false);
  });
  it('缺乏固定场次、人数、预算或来源的任务无效', () => {
    expect(() => validateEvent({ title: '音乐节', quantity: 0 } as never)).toThrow();
  });
});
