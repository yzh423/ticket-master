import type { PlatformId, PerformanceSession, Tier } from './model';
import { Temporal } from '@js-temporal/polyfill';
import { officialUrl } from './rules';

export type DamaiPublicFields = {
  title: string;
  dateText: string;
  venueText: string;
  appOnly: boolean;
  limitText: string;
  performDates?: string[];
  ticketOptions?: Tier[];
  priceRange?: string;
};

export type DiscoveredSession = PerformanceSession;

export type DiscoveredEvent = {
  platform: PlatformId;
  title: string;
  dateHint: string;
  sessionLocal: string;
  sessions: DiscoveredSession[];
  ticketOptions: Tier[];
  priceRange: string;
  currency: string;
  venue: string;
  appOnly: boolean;
  ruleNote: string;
  eventUrl: string;
  sourceUrl: string;
};

export type StructuredPublicFields = {
  title: string;
  dateText: string;
  venueText: string;
  dateOptions?: string[];
  ticketOptions?: Tier[];
  currency?: string;
};

export type DiscoveryViewState = {
  platform: PlatformId;
  url: string;
  hostname: string;
  trustedDomain: boolean;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error: string;
  tabs: { platform: PlatformId; url: string }[];
};

export function parseStructuredPublicEvent(
  platform: PlatformId,
  url: string,
  fields: StructuredPublicFields,
): DiscoveredEvent {
  if (!officialUrl(platform, url)) throw new Error('当前页面不是所选平台的官方网址');
  const title = fields.title.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!title) throw new Error('当前页面没有可识别的公开活动资料，请打开具体活动详情');
  const sessions = sessionsFromDates(
    fields.dateOptions?.length ? fields.dateOptions : [fields.dateText],
  );
  return {
    platform,
    title,
    dateHint: fields.dateText.trim().slice(0, 100),
    sessionLocal: sessions[0]?.local ?? '',
    sessions,
    ticketOptions: distinctTicketOptions(fields.ticketOptions ?? []),
    priceRange: '',
    currency: /^[A-Z]{3}$/.test(fields.currency ?? '') ? fields.currency! : '',
    venue: fields.venueText.trim().replace(/\s+/g, ' ').slice(0, 160),
    appOnly: false,
    ruleNote: '信息来自当前官方页面公开的活动标记；请核对固定场次、所在地时区、票档与购票资格。',
    eventUrl: url,
    sourceUrl: url,
  };
}

function damaiItemUrl(input: string): string {
  const url = new URL(input);
  const id = url.searchParams.get('id');
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'detail.damai.cn' ||
    url.pathname !== '/item.htm' ||
    url.username ||
    url.password ||
    !id ||
    !/^\d{1,20}$/.test(id)
  )
    throw new Error('请使用大麦官方活动详情链接');
  return `https://detail.damai.cn/item.htm?id=${id}`;
}

export function damaiDiscoveryUrl(input: string): string {
  const value = input.trim();
  if (!value || value.length > 120) throw new Error('请输入 1–120 字的演出关键词或大麦活动链接');
  if (/^https?:/i.test(value)) return damaiItemUrl(value);
  if (value.includes('://')) throw new Error('请使用大麦官方活动详情链接');
  const url = new URL('https://search.damai.cn/search.htm');
  url.searchParams.set('keyword', value);
  return url.toString();
}

function singleSession(dateHint: string): string {
  const match = dateHint.match(
    /^(20\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:\s*周[一二三四五六日天])?[ T](\d{1,2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/,
  );
  if (!match) return '';
  try {
    const [year, month, day, hour, minute] = match.slice(1).map(Number);
    return Temporal.PlainDateTime.from(
      { year, month, day, hour, minute },
      { overflow: 'reject' },
    ).toString({
      smallestUnit: 'minute',
    });
  } catch {
    return '';
  }
}

function sessionsFromDates(values: string[]): DiscoveredSession[] {
  const seen = new Set<string>();
  const sessions: DiscoveredSession[] = [];
  for (const raw of values.slice(0, 80)) {
    if (typeof raw !== 'string') continue;
    const label = raw.trim().replace(/\s+/g, ' ').slice(0, 80);
    const local = singleSession(label);
    if (!local || seen.has(local)) continue;
    seen.add(local);
    sessions.push({ local, label });
  }
  return sessions.sort((a, b) => a.local.localeCompare(b.local));
}

function distinctTicketOptions(values: Tier[]): Tier[] {
  const seen = new Set<string>();
  const options: Tier[] = [];
  for (const value of values.slice(0, 80)) {
    const label = typeof value?.label === 'string' ? value.label.trim().replace(/\s+/g, ' ') : '';
    const unitPrice = value?.unitPrice;
    if (
      !label ||
      label.length > 80 ||
      typeof unitPrice !== 'number' ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    )
      continue;
    const key = `${label}\u0000${unitPrice}`;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ label, unitPrice });
  }
  return options;
}

export function parseDamaiPublicDetail(url: string, fields: DamaiPublicFields): DiscoveredEvent {
  const eventUrl = damaiItemUrl(url);
  const title = fields.title.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!title) throw new Error('当前大麦页面没有可识别的活动标题');
  const dateHint = fields.dateText
    .trim()
    .replace(/^时间\s*[:：]\s*/, '')
    .slice(0, 100);
  const venue = fields.venueText
    .trim()
    .replace(/^场馆\s*[:：]\s*/, '')
    .slice(0, 160);
  const limitText = fields.limitText.trim().slice(0, 180);
  const sessions = sessionsFromDates(
    fields.performDates?.length ? fields.performDates : [dateHint],
  );
  const ticketOptions = distinctTicketOptions(fields.ticketOptions ?? []);
  return {
    platform: 'damai',
    title,
    dateHint,
    sessionLocal: sessions[0]?.local ?? singleSession(dateHint),
    sessions,
    ticketOptions,
    priceRange: (fields.priceRange ?? '').trim().slice(0, 80),
    currency: 'CNY',
    venue,
    appOnly: fields.appOnly,
    ruleNote: [
      fields.appOnly ? '该官方网页提示需在大麦 App 下单。' : '请以大麦当前页面核对购票渠道。',
      limitText,
    ]
      .filter(Boolean)
      .join(' '),
    eventUrl,
    sourceUrl: eventUrl,
  };
}
