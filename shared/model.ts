export type PlatformId =
  | 'damai'
  | 'maoyan'
  | 'piaoxingqiu'
  | 'showstart'
  | 'fenwandao'
  | 'moretickets'
  | 'hkticketing'
  | 'cityline'
  | 'urbtix'
  | 'ticketmaster'
  | 'axs'
  | 'dice'
  | 'eventbrite'
  | 'seetickets'
  | 'livenation'
  | 'seatgeek'
  | 'stubhub'
  | 'vividseats'
  | 'tickpick'
  | 'klook'
  | 'kkday'
  | 'trip'
  | 'other';
export type SaleType = 'presale' | 'public' | 'replenishment' | 'waitlist' | 'invitation';
export type OpportunityStatus = 'planned' | 'registered' | 'completed' | 'missed';
export type AttemptStatus =
  | 'participated'
  | 'queued'
  | 'manual_action'
  | 'pending_payment'
  | 'paid_pending_issue'
  | 'issued'
  | 'failed'
  | 'unknown';
export type Availability = 'unknown' | 'available' | 'sold_out';
export type Tier = { label: string; unitPrice: number | null };
export type SaleOpportunity = {
  id: string;
  type: SaleType;
  localTime: string;
  timeZone: string;
  startsAt: string;
  endsAt: string | null;
  eligibility: string;
  url: string;
  sourceUrl: string;
  verifiedAt: string;
  status: OpportunityStatus;
  note: string;
};
export type AttemptResult = {
  id: string;
  at: string;
  opportunityId: string | null;
  status: AttemptStatus;
  tier: string;
  total: number | null;
  evidence: string;
  note: string;
};
export type ChecklistKey =
  | 'account'
  | 'identity'
  | 'attendees'
  | 'qualification'
  | 'payment'
  | 'channel'
  | 'network'
  | 'notification';
export type EventRecord = {
  id: string;
  title: string;
  platform: PlatformId;
  venue: string;
  sessionLocal: string;
  timeZone: string;
  sessionAt: string;
  currency: string;
  quantity: number;
  budget: number;
  owner: string;
  tiers: Tier[];
  eventUrl: string;
  sourceUrl: string;
  verifiedAt: string;
  ruleNote: string;
  opportunities: SaleOpportunity[];
  checklist: Record<ChecklistKey, boolean>;
  attempts: AttemptResult[];
  followUntil: string;
  createdAt: string;
  updatedAt: string;
};
export const checklistLabels: Record<ChecklistKey, string> = {
  account: '已登录正确账号并核对手机号',
  identity: '实名、证件及购买资格已核对',
  attendees: '观演人已配置，人数一致',
  qualification: '优先购或候补资格已确认',
  payment: '付款方式可用且金额可承担',
  channel: '已确认本场使用 App 或网页',
  network: '设备及网络可用',
  notification: '官方 App 消息通知已开启',
};
export const saleLabels: Record<SaleType, string> = {
  presale: '优先购',
  public: '公开销售',
  replenishment: '正式补票',
  waitlist: '官方候补',
  invitation: '购买邀请',
};
export const resultLabels: Record<AttemptStatus, string> = {
  participated: '已参加销售',
  queued: '排队中',
  manual_action: '待人工处理',
  pending_payment: '待支付',
  paid_pending_issue: '已付款待出票',
  issued: '已出票',
  failed: '失败',
  unknown: '结果未知',
};
export const platformLabels: Record<PlatformId, string> = {
  damai: '大麦',
  maoyan: '猫眼演出',
  piaoxingqiu: '票星球',
  showstart: '秀动',
  fenwandao: '纷玩岛',
  moretickets: '摩天轮票务',
  hkticketing: 'HK Ticketing',
  cityline: 'Cityline',
  urbtix: 'URBTIX',
  ticketmaster: 'Ticketmaster',
  axs: 'AXS',
  dice: 'DICE',
  eventbrite: 'Eventbrite',
  seetickets: 'See Tickets',
  livenation: 'Live Nation',
  seatgeek: 'SeatGeek',
  stubhub: 'StubHub · 转售',
  vividseats: 'Vivid Seats · 转售',
  tickpick: 'TickPick · 转售',
  klook: 'Klook',
  kkday: 'KKday',
  trip: 'Trip.com',
  other: '其他官方渠道',
};
export const defaultChecklist = (): Record<ChecklistKey, boolean> => ({
  account: false,
  identity: false,
  attendees: false,
  qualification: false,
  payment: false,
  channel: false,
  network: false,
  notification: false,
});
