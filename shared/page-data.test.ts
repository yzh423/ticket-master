import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { collectDamaiPageFields, collectStructuredPageFields } from './page-data';

describe('大麦公开页面资料', () => {
  it('从官方页面公开脚本提取候选场次与价格范围，并识别 App 专属提示', () => {
    const texts: Record<string, string> = {
      '.hd .title span': '测试巡演',
      '.hd .time': '时间：2026.09.19-10.05',
      '.hd .addr': '场馆：深圳市 | 测试体育场',
      '.notice0': '每笔订单最多购买4张。',
    };
    const doc = {
      querySelector: (selector: string) => ({ textContent: texts[selector] ?? '' }),
      querySelectorAll: () => [
        {
          textContent:
            '{"performDate":"2026-09-19 周六 19:00","performDate":"2026-10-01 周四 19:00","priceRange":"¥380 - ¥1680"}',
        },
      ],
      body: { innerText: '该渠道不支持购票，请到大麦App购买' },
    } as unknown as Document;
    expect(collectDamaiPageFields(doc)).toMatchObject({
      title: '测试巡演',
      appOnly: true,
      performDates: ['2026-09-19 周六 19:00', '2026-10-01 周四 19:00'],
      priceRange: '¥380 - ¥1680',
      ticketOptions: [],
    });
    expect(
      runInNewContext(`(${collectDamaiPageFields.toString()})(document)`, { document: doc }),
    ).toMatchObject({ performDates: ['2026-09-19 周六 19:00', '2026-10-01 周四 19:00'] });
  });

  it('页面提示只写在公开商品状态中时也识别为 App 专属', () => {
    const doc = {
      querySelector: () => ({ textContent: '测试演出' }),
      querySelectorAll: () => [{ textContent: '{"buyBtnText":"该渠道不支持购票"}' }],
      body: { innerText: '' },
    } as unknown as Document;
    expect(collectDamaiPageFields(doc).appOnly).toBe(true);
  });
});

describe('其他平台的公开活动标记', () => {
  it('只提取同一 Event 中明确命名和标价的选项', () => {
    const doc = {
      querySelectorAll: () => [
        {
          textContent: JSON.stringify({
            '@type': 'Event',
            name: 'Example Concert',
            startDate: '2026-11-02T19:30:00-05:00',
            subEvent: [{ startDate: '2026-11-03T19:30:00-05:00' }],
            location: { name: 'Example Arena' },
            offers: [
              { name: 'Lower Bowl', price: '120', priceCurrency: 'USD' },
              { name: 'Upper Bowl', price: 80, priceCurrency: 'USD' },
              { lowPrice: 40, priceCurrency: 'USD' },
            ],
          }),
        },
      ],
    } as unknown as Document;
    expect(collectStructuredPageFields(doc)).toEqual({
      title: 'Example Concert',
      dateText: '2026-11-02T19:30:00-05:00',
      dateOptions: ['2026-11-02T19:30:00-05:00', '2026-11-03T19:30:00-05:00'],
      venueText: 'Example Arena',
      ticketOptions: [
        { label: 'Lower Bowl', unitPrice: 120 },
        { label: 'Upper Bowl', unitPrice: 80 },
      ],
      currency: 'USD',
    });
    expect(
      runInNewContext(`(${collectStructuredPageFields.toString()})(document)`, { document: doc }),
    ).toMatchObject({
      ticketOptions: [
        { label: 'Lower Bowl', unitPrice: 120 },
        { label: 'Upper Bowl', unitPrice: 80 },
      ],
    });
  });

  it('报价币种不完整时不推断统一币种', () => {
    const doc = {
      querySelectorAll: () => [
        {
          textContent: JSON.stringify({
            '@type': 'Event',
            name: 'Mixed Offers',
            startDate: '2026-11-02T19:30:00-05:00',
            offers: [
              { name: 'A', price: 100, priceCurrency: 'USD' },
              { name: 'B', price: 80 },
            ],
          }),
        },
      ],
    } as unknown as Document;
    expect(collectStructuredPageFields(doc).currency).toBe('');
  });
});
