import type { PlatformId } from './model';
import { Temporal } from '@js-temporal/polyfill';
import { officialUrl } from './rules';

export type DamaiPublicFields = {
  title: string;
  dateText: string;
  venueText: string;
  appOnly: boolean;
  limitText: string;
};

export type DiscoveredEvent = {
  platform: PlatformId;
  title: string;
  dateHint: string;
  sessionLocal: string;
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
};

export function parseStructuredPublicEvent(
  platform: PlatformId,
  url: string,
  fields: StructuredPublicFields,
): DiscoveredEvent {
  if (!officialUrl(platform, url)) throw new Error('当前页面不是所选平台的官方网址');
  const title = fields.title.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!title) throw new Error('当前页面没有可识别的公开活动资料，请打开具体活动详情');
  return {
    platform,
    title,
    dateHint: fields.dateText.trim().slice(0, 100),
    sessionLocal: '',
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
    /^(20\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:\s*周[一二三四五六日天])?\s+(\d{1,2}):(\d{2})$/,
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
  return {
    platform: 'damai',
    title,
    dateHint,
    sessionLocal: singleSession(dateHint),
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
