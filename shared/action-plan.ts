import type { EventRecord, SaleOpportunity } from './model';
import { checklistLabels, saleLabels } from './model';
import { hasOpenOrder, pendingPaymentAttempts, preparationGaps } from './rules';

export type TaskAction = {
  eventId: string;
  eventTitle: string;
  kind: 'payment' | 'missing_sale' | 'prepare' | 'qualification' | 'review' | 'follow_up';
  title: string;
  detail: string;
  target: 'sales' | 'ready' | 'results';
  dueAt: string | null;
  priority: number;
};

function action(
  event: EventRecord,
  kind: TaskAction['kind'],
  title: string,
  detail: string,
  target: TaskAction['target'],
  dueAt: string | null,
  priority: number,
): TaskAction {
  return {
    eventId: event.id,
    eventTitle: event.title,
    kind,
    title,
    detail,
    target,
    dueAt,
    priority,
  };
}

function nextSale(event: EventRecord, now: number): SaleOpportunity | undefined {
  return event.opportunities
    .filter(
      (item) =>
        item.status !== 'completed' &&
        item.status !== 'missed' &&
        Date.parse(item.startsAt) >= now - 2 * 60 * 60_000,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

function actionForEvent(event: EventRecord, now: number): TaskAction | null {
  const pending = pendingPaymentAttempts(event.attempts).sort((a, b) =>
    (a.paymentDeadline ?? '9999').localeCompare(b.paymentDeadline ?? '9999'),
  )[0];
  if (pending) {
    const expired = pending.paymentDeadline && Date.parse(pending.paymentDeadline) <= now;
    return action(
      event,
      'payment',
      expired ? '核对待支付订单状态' : '先处理待支付订单',
      expired
        ? '记录的截止时间已过；以官方订单页确认是否仍可支付。'
        : '按官方页面倒计时付款或核对结果，避免重复提交。',
      'results',
      pending.paymentDeadline ?? null,
      0,
    );
  }
  if (hasOpenOrder(event.attempts) || Date.parse(event.followUntil) < now) return null;

  const sale = nextSale(event, now);
  if (!sale) {
    return action(
      event,
      event.opportunities.length ? 'follow_up' : 'missing_sale',
      event.opportunities.length ? '核对官方后续机会' : '补全官方销售日历',
      event.opportunities.length
        ? '首轮机会已结束；只记录有来源的正式补票或原生候补。'
        : '查看主办方公告，录入有资格参与的开售、预售或候补。',
      'sales',
      null,
      3,
    );
  }
  const gaps = preparationGaps(event.checklist, sale.type);
  if (gaps.length) {
    const first = gaps.includes('qualification') ? 'qualification' : gaps[0];
    return action(
      event,
      'prepare',
      `${gaps.length} 项准备待核对`,
      `先确认：${checklistLabels[first]}。这些项目需要你在原平台人工核实。`,
      'ready',
      sale.startsAt,
      1,
    );
  }
  if (
    sale.status === 'planned' &&
    (sale.type === 'presale' || sale.type === 'waitlist' || sale.type === 'invitation')
  ) {
    return action(
      event,
      'qualification',
      `核对${saleLabels[sale.type]}参与状态`,
      '在原平台确认本场资格、登记或邀请；不要把任务记录当成已报名。',
      'sales',
      sale.startsAt,
      2,
    );
  }
  return action(
    event,
    'review',
    `复核${saleLabels[sale.type]}公告`,
    sale.url || event.eventUrl
      ? '确认时间、人数与入口没有变化，再按原平台规则参与。'
      : '确认本场使用 App 还是网页，以及有效的官方入口。',
    'sales',
    sale.startsAt,
    4,
  );
}

export function planActions(events: EventRecord[], now: number): TaskAction[] {
  return events
    .map((event) => actionForEvent(event, now))
    .filter((item): item is TaskAction => item !== null)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') ||
        a.eventTitle.localeCompare(b.eventTitle, 'zh-CN'),
    );
}
