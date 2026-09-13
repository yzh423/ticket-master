import { describe, expect, it } from 'vitest';
import { resolveBrowserTarget } from './browser';
import type { EventRecord } from './model';

const event = {
  id: 'one',
  title: '测试演出',
  platform: 'damai',
  quantity: 2,
  budget: 1200,
  currency: 'CNY',
  tiers: [{ label: 'A', unitPrice: 580 }],
  eventUrl: 'https://detail.damai.cn/item.htm?id=1',
  opportunities: [{ id: 'sale', url: 'https://detail.damai.cn/item.htm?id=2' }],
} as EventRecord;

describe('内置官方网页目标', () => {
  it('同一活动的官方销售机会优先于活动主页', () => {
    expect(resolveBrowserTarget([event], 'one', 'sale').url).toBe(
      'https://detail.damai.cn/item.htm?id=2',
    );
  });
  it('拒绝其他任务的机会和非官方域名', () => {
    expect(() => resolveBrowserTarget([event], 'one', 'other')).toThrow();
    expect(() =>
      resolveBrowserTarget([{ ...event, eventUrl: 'https://damai.cn.evil.example' }], 'one'),
    ).toThrow();
  });
  it('App 专属项目没有网页入口时给出明确错误', () => {
    expect(() => resolveBrowserTarget([{ ...event, eventUrl: '' }], 'one')).toThrow();
  });
});
