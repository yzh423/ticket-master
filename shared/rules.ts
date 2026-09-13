import { Temporal } from '@js-temporal/polyfill';
import type { Availability, EventRecord, PlatformId, Tier } from './model';

const domains: Partial<Record<PlatformId, string[]>> = {
  damai: ['damai.cn'],
  maoyan: ['maoyan.com'],
  piaoxingqiu: ['piaoxingqiu.com'],
  showstart: ['showstart.com'],
  fenwandao: ['fenwandao.com'],
  moretickets: ['moretickets.com'],
  hkticketing: ['hkticketing.com'],
  cityline: ['cityline.com'],
  urbtix: ['urbtix.hk'],
  ticketmaster: ['ticketmaster.com', 'ticketmaster.cn', 'ticketmaster.hk', 'ticketmaster.co.uk'],
  axs: ['axs.com'],
  dice: ['dice.fm'],
  eventbrite: ['eventbrite.com'],
  seetickets: ['seetickets.com', 'seetickets.co.uk'],
  livenation: ['livenation.com'],
  seatgeek: ['seatgeek.com'],
  stubhub: ['stubhub.com'],
  vividseats: ['vividseats.com'],
  tickpick: ['tickpick.com'],
  klook: ['klook.com'],
  kkday: ['kkday.com'],
  trip: ['trip.com'],
};
export function officialUrl(platform: PlatformId, input: string): boolean {
  try {
    const url = new URL(input);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      Boolean(
        domains[platform]?.some(
          (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
        ),
      )
    );
  } catch {
    return false;
  }
}

export function parseLocalInstant(localTime: string, timeZone: string): string {
  const plain = Temporal.PlainDateTime.from(localTime);
  const instant = plain.toZonedDateTime(timeZone, { disambiguation: 'reject' }).toInstant();
  return new Date(instant.epochMilliseconds).toISOString();
}

export function formatLocalInstant(instant: string, timeZone: string): string {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: 'minute' });
}

export type Decision =
  | { kind: 'recommend'; index: number; note: string }
  | { kind: 'uncertain' | 'sold_out' | 'over_budget' | 'check_total'; note: string };
export function chooseTier(
  tiers: Tier[],
  availability: Availability[],
  quantity: number,
  budget: number,
): Decision {
  if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(budget) || budget <= 0)
    throw new Error('人数或预算无效');
  let overBudget = false,
    needsTotal = false,
    unknown = false;
  for (let i = 0; i < tiers.length; i++) {
    if (availability[i] === 'unknown') {
      unknown = true;
      continue;
    }
    if (availability[i] !== 'available') continue;
    const price = tiers[i].unitPrice;
    if (price === null) {
      needsTotal = true;
      continue;
    }
    if (price * quantity > budget) {
      overBudget = true;
      continue;
    }
    return {
      kind: 'recommend',
      index: i,
      note: '人工核对实际含服务费总额与购票资格后选择；页面显示可买并不等于已锁票。',
    };
  }
  if (needsTotal)
    return { kind: 'check_total', note: '票价未知，先核对订单实际总额；不要超预算提交。' };
  if (unknown)
    return {
      kind: 'uncertain',
      note: '部分页面状态未知，请保持原会话并按官方页面确认，勿当作售罄。',
    };
  if (overBudget) return { kind: 'over_budget', note: '当前可买票档超出预算，不建议购买。' };
  return { kind: 'sold_out', note: '当前人工确认的可接受票档均不可买，跟进官方后续机会。' };
}

export function remindersDue(startsAt: string, now: number, delivered: Set<string>): string[] {
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) return [];
  return (
    [
      ['24h', 86_400_000],
      ['30m', 1_800_000],
      ['5m', 300_000],
      ['now', 0],
    ] as const
  )
    .filter(
      ([key, offset]) =>
        !delivered.has(key) && now >= start - offset && now < start - offset + 60_000,
    )
    .map(([key]) => key);
}

export function validateEvent(value: EventRecord): EventRecord {
  if (
    !value ||
    !value.id ||
    !value.title?.trim() ||
    !value.sessionLocal ||
    !value.timeZone ||
    !value.sourceUrl?.trim() ||
    !value.verifiedAt
  )
    throw new Error('请填写活动、固定场次、时区和规则来源');
  if (!Object.hasOwn(domains, value.platform) && value.platform !== 'other')
    throw new Error('平台无效');
  if (
    !Number.isInteger(value.quantity) ||
    value.quantity < 1 ||
    value.quantity > 20 ||
    !Number.isFinite(value.budget) ||
    value.budget <= 0
  )
    throw new Error('请填写有效人数与总预算');
  if (
    !Array.isArray(value.tiers) ||
    value.tiers.length === 0 ||
    value.tiers.length > 8 ||
    value.tiers.some(
      (t) =>
        !t.label?.trim() ||
        (t.unitPrice !== null && (!Number.isFinite(t.unitPrice) || t.unitPrice < 0)),
    )
  )
    throw new Error('请按优先顺序填写可接受票档与单价');
  if (value.sessionAt !== parseLocalInstant(value.sessionLocal, value.timeZone))
    throw new Error('场次时间与时区不匹配');
  if (
    !Number.isFinite(Date.parse(value.followUntil)) ||
    Date.parse(value.followUntil) > Date.parse(value.sessionAt)
  )
    throw new Error('跟进截止不能晚于演出开始');
  if (value.eventUrl && !officialUrl(value.platform, value.eventUrl))
    throw new Error('官方入口域名尚未验证，请改用已验证的平台地址');
  if (
    !Array.isArray(value.opportunities) ||
    value.opportunities.length > 100 ||
    !Array.isArray(value.attempts)
  )
    throw new Error('任务记录无效');
  for (const item of value.opportunities) {
    if (
      !item.id ||
      !item.sourceUrl?.trim() ||
      !item.verifiedAt ||
      item.startsAt !== parseLocalInstant(item.localTime, item.timeZone) ||
      (item.url && !officialUrl(value.platform, item.url))
    )
      throw new Error('销售机会需要有效时间、来源和官方入口');
    if (
      item.endsAt &&
      (Number.isNaN(Date.parse(item.endsAt)) || Date.parse(item.endsAt) < Date.parse(item.startsAt))
    )
      throw new Error('机会截止时间无效');
  }
  for (const attempt of value.attempts) {
    if (
      !attempt.id ||
      !Number.isFinite(Date.parse(attempt.at)) ||
      (attempt.opportunityId && !value.opportunities.some((o) => o.id === attempt.opportunityId))
    )
      throw new Error('购票结果关联的机会或时间无效');
    if (
      ['pending_payment', 'paid_pending_issue', 'issued'].includes(attempt.status) &&
      !attempt.evidence?.trim()
    )
      throw new Error('待支付或已完成结果需要官方确认依据');
    if (attempt.total !== null && (!Number.isFinite(attempt.total) || attempt.total < 0))
      throw new Error('记录的实付总额无效');
  }
  return value;
}
