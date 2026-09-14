import type { EventRecord, PlatformId, Tier } from './model';
import { saleLabels } from './model';
import { officialUrl } from './rules';

export type EventBrowserTarget = {
  mode: 'event';
  eventId: string;
  title: string;
  platform: PlatformId;
  url: string;
  quantity: number;
  budget: number;
  currency: string;
  tiers: Tier[];
  opportunity: string | null;
};

export type DiscoveryBrowserTarget = {
  mode: 'discovery';
  title: string;
  platform: 'damai';
  url: string;
  query: string;
};

export type BrowserTarget = EventBrowserTarget | DiscoveryBrowserTarget;

export type BrowserState = {
  target: BrowserTarget;
  url: string;
  hostname: string;
  trustedDomain: boolean;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error: string;
};

export function resolveBrowserTarget(
  events: EventRecord[],
  eventId: string,
  opportunityId?: string,
): EventBrowserTarget {
  const event = events.find((item) => item.id === eventId);
  if (!event) throw new Error('任务已不存在，请返回列表重新选择');
  const sale = opportunityId
    ? event.opportunities.find((item) => item.id === opportunityId)
    : undefined;
  if (opportunityId && !sale) throw new Error('销售机会不属于当前任务');
  const url = sale?.url || event.eventUrl;
  if (!url) throw new Error('本场未设置可用的官方网页入口，请使用原生 App');
  if (!officialUrl(event.platform, url)) throw new Error('该网址未通过平台官方域名检查');
  return {
    mode: 'event',
    eventId: event.id,
    title: event.title,
    platform: event.platform,
    url,
    quantity: event.quantity,
    budget: event.budget,
    currency: event.currency,
    tiers: event.tiers,
    opportunity: sale ? saleLabels[sale.type] : null,
  };
}
