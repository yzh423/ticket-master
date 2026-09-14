import { describe, expect, it } from 'vitest';
import { damaiDiscoveryUrl, parseDamaiPublicDetail, parseStructuredPublicEvent } from './discovery';

describe('大麦发现入口', () => {
  it('把关键词编码为官方搜索网址，也允许直接使用官方项目链接', () => {
    expect(damaiDiscoveryUrl('邓紫棋 深圳')).toBe(
      'https://search.damai.cn/search.htm?keyword=%E9%82%93%E7%B4%AB%E6%A3%8B+%E6%B7%B1%E5%9C%B3',
    );
    expect(damaiDiscoveryUrl('https://detail.damai.cn/item.htm?id=1052123401368')).toBe(
      'https://detail.damai.cn/item.htm?id=1052123401368',
    );
  });

  it('拒绝空搜索、过长输入和伪装成官方的链接', () => {
    expect(() => damaiDiscoveryUrl(' ')).toThrow();
    expect(() => damaiDiscoveryUrl('x'.repeat(121))).toThrow();
    expect(() => damaiDiscoveryUrl('https://detail.damai.cn.evil.example/item.htm?id=1')).toThrow();
  });
});

describe('其他平台公开活动资料', () => {
  it('只从所选官方平台的活动页建立待核对任务', () => {
    expect(
      parseStructuredPublicEvent('ticketmaster', 'https://www.ticketmaster.com/example/event/123', {
        title: 'Example Concert',
        dateText: '2026-11-02T19:30:00-05:00',
        venueText: 'Example Arena',
      }),
    ).toMatchObject({
      platform: 'ticketmaster',
      title: 'Example Concert',
      venue: 'Example Arena',
      sessionLocal: '2026-11-02T19:30',
    });
    expect(() =>
      parseStructuredPublicEvent('ticketmaster', 'https://fake.example/event/123', {
        title: 'Example Concert',
        dateText: '',
        venueText: '',
      }),
    ).toThrow();
    expect(() =>
      parseStructuredPublicEvent('axs', 'https://www.axs.com/events/123', {
        title: '',
        dateText: '',
        venueText: '',
      }),
    ).toThrow();
  });

  it('从活动结构化日期和明确报价提供选择，不把未标价 offer 当成票档', () => {
    const found = parseStructuredPublicEvent(
      'ticketmaster',
      'https://www.ticketmaster.com/example/event/123',
      {
        title: 'Example Concert',
        dateText: '2026-11-02T19:30:00-05:00',
        venueText: 'Example Arena',
        dateOptions: ['2026-11-02T19:30:00-05:00', '2026-11-03T19:30:00-05:00'],
        ticketOptions: [
          { label: 'Lower Bowl', unitPrice: 120 },
          { label: 'Unknown', unitPrice: null },
        ],
        currency: 'USD',
      },
    );
    expect(found.sessions.map((session) => session.local)).toEqual([
      '2026-11-02T19:30',
      '2026-11-03T19:30',
    ]);
    expect(found.ticketOptions).toEqual([{ label: 'Lower Bowl', unitPrice: 120 }]);
    expect(found.currency).toBe('USD');
  });
});

describe('大麦公开详情提取', () => {
  const url = 'https://detail.damai.cn/item.htm?id=1052123401368';
  it('保留日期范围供核对，不推断固定场次或开售时间', () => {
    expect(
      parseDamaiPublicDetail(url, {
        title: '【深圳】G.E.M.邓紫棋 I AM GLORIA - 深圳站',
        dateText: '时间：2026.09.19-10.05',
        venueText: '场馆：深圳市 | 深圳大运中心体育场',
        appOnly: true,
        limitText: '每笔订单最多购买4张、每个账号最多购买4张。',
      }),
    ).toMatchObject({
      platform: 'damai',
      title: '【深圳】G.E.M.邓紫棋 I AM GLORIA - 深圳站',
      dateHint: '2026.09.19-10.05',
      sessionLocal: '',
      venue: '深圳市 | 深圳大运中心体育场',
      appOnly: true,
      ruleNote: expect.stringContaining('每笔订单最多购买4张'),
      eventUrl: url,
    });
  });

  it('单一完整演出时间可以成为待核对的场次建议', () => {
    expect(
      parseDamaiPublicDetail('https://detail.damai.cn/item.htm?id=123', {
        title: '测试演出',
        dateText: '时间：2026.09.23 周三 19:30',
        venueText: '场馆：北京市 | 测试剧场',
        appOnly: false,
        limitText: '',
      }).sessionLocal,
    ).toBe('2026-09-23T19:30');
  });

  it('从明确列出的多个场次和票档生成可选项，保留用户选择权', () => {
    const found = parseDamaiPublicDetail(url, {
      title: '测试演出',
      dateText: '时间：2026.09.19-10.05',
      venueText: '场馆：深圳市 | 测试体育场',
      appOnly: true,
      limitText: '',
      performDates: [
        '2026-09-19 周六 19:00',
        '2026-10-01 周四 19:00',
        '2026-09-19 周六 19:00',
        '2026-02-30 19:00',
      ],
      ticketOptions: [
        { label: '看台', unitPrice: 580 },
        { label: '内场', unitPrice: 1280 },
        { label: '看台', unitPrice: 580 },
      ],
      priceRange: '¥380 - ¥1680',
    });
    expect(found.sessions).toEqual([
      { local: '2026-09-19T19:00', label: '2026-09-19 周六 19:00' },
      { local: '2026-10-01T19:00', label: '2026-10-01 周四 19:00' },
    ]);
    expect(found.sessionLocal).toBe('');
    expect(found.ticketOptions).toEqual([
      { label: '看台', unitPrice: 580 },
      { label: '内场', unitPrice: 1280 },
    ]);
    expect(found.priceRange).toBe('¥380 - ¥1680');
  });

  it('价格范围不是独立票档，不能据此虚构票档', () => {
    const found = parseDamaiPublicDetail(url, {
      title: '测试演出',
      dateText: '时间：2026.09.19-10.05',
      venueText: '场馆：测试体育场',
      appOnly: true,
      limitText: '',
      performDates: ['2026-09-19 周六 19:00'],
      priceRange: '¥380 - ¥1680',
    });
    expect(found.sessionLocal).toBe('2026-09-19T19:00');
    expect(found.ticketOptions).toEqual([]);
  });

  it('无效日期不能被自动修正成另一场时间', () => {
    expect(
      parseDamaiPublicDetail('https://detail.damai.cn/item.htm?id=123', {
        title: '测试演出',
        dateText: '时间：2026.02.30 19:30',
        venueText: '场馆：测试场馆',
        appOnly: false,
        limitText: '',
      }).sessionLocal,
    ).toBe('');
  });

  it('只接受大麦商品页和有活动标题的公开数据', () => {
    const fields = {
      title: '测试演出',
      dateText: '时间：2026.09.23 19:30',
      venueText: '场馆：测试场馆',
      appOnly: false,
      limitText: '',
    };
    expect(() =>
      parseDamaiPublicDetail('https://passport.damai.cn/accountinfo/myinfo', fields),
    ).toThrow();
    expect(() => parseDamaiPublicDetail(url, { ...fields, title: '' })).toThrow();
  });
});
