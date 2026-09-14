export const marketComparisons = [
  {
    id: 'bandsintown',
    category: '演出发现',
    product: 'Bandsintown',
    strength: '关注艺人后可收到新演出、预售和开售提醒。',
    ourRole: '把已经确认的不同售票渠道、人数和可接受票档放进同一任务。',
    gap: '尚不能自动发现你没有录入的新演出。',
    recommendation: '在艺人和原平台开启原生提醒，再把确定的销售时间录入候票台。',
    source: 'https://www.artist.bandsintown.com/overview',
  },
  {
    id: 'ticketmaster',
    category: '平台原生提醒',
    product: 'Ticketmaster',
    strength: '可收藏活动并设置开售提醒，通知可直达销售页。',
    ourRole: '同时追踪其他平台的机会和个人可接受票档。',
    gap: '没有 Ticketmaster 的账号、队列或交易权限。',
    recommendation: '原平台设置提醒并保持队列会话；候票台用于准备和结果记录。',
    source:
      'https://help.ticketmaster.com/hc/en-us/articles/18179879687825-How-do-I-set-a-reminder-for-an-event-s-ticket-sale',
  },
  {
    id: 'fenwandao',
    category: '原生候补与优先购',
    product: '纷玩岛',
    strength: '平台介绍列有独家优先购、候补和一键抢票；是否开放取决于活动。',
    ourRole: '核对本场是否适用，并把资格、日期和后续结果合并到同一工作流。',
    gap: '不能代替原平台登记候补或提交订单。',
    recommendation: '先在原平台完成资格与候补操作，候票台记录已完成状态。',
    source: 'https://apps.apple.com/cn/app/id1566835977',
  },
  {
    id: 'distill',
    category: '网页变化监控',
    product: 'Distill',
    strength: '按计划比较网页内容变化，并通过多种渠道发出通知。',
    ourRole: '区分公告、排队、待支付和出票，避免把页面变化误判为有票。',
    gap: '不自动监控任意网站；来源和时间变更需要人工核实。',
    recommendation: '对排队页遵守平台规则，不用通用刷新监控替代官方候补通知。',
    source: 'https://distill.io/docs/web-monitor/what-is-distill/',
  },
] as const;

export type MarketComparisonId = (typeof marketComparisons)[number]['id'];

export function marketSource(id: string): string {
  const item = marketComparisons.find((entry) => entry.id === id);
  if (!item) throw new Error('资料来源无效');
  return item.source;
}
