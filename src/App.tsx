import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Info,
  Link2,
  ListChecks,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Ticket,
  Trash2,
} from 'lucide-react';
import { EventForm } from './components/EventForm';
import { OpportunityForm } from './components/OpportunityForm';
import { chooseTier, formatLocalInstant, parseLocalInstant } from '../shared/rules';
import {
  checklistLabels,
  platformLabels,
  resultLabels,
  saleLabels,
  type AttemptStatus,
  type Availability,
  type EventRecord,
  type SaleOpportunity,
} from '../shared/model';

type Page = 'dashboard' | 'calendar' | 'guide' | 'device';
const guide: { id: keyof typeof platformLabels; text: string; source: string }[] = [
  {
    id: 'damai',
    text: '大麦按本场项目规则购票；实名、App 专属下单及付款期限须提前核对。当前只提供官方流程辅助。',
    source:
      'https://legal.damai.cn/legal-agreement/terms/c_platform_service_agreement/20240408162722609/20240408162722609.html',
  },
  {
    id: 'maoyan',
    text: '场次和实名规则由具体项目决定。先整理观演人与项目须知。',
    source: 'https://m.maoyan.com/terms/terms',
  },
  {
    id: 'piaoxingqiu',
    text: '部分活动提供原生组队帮抢；以该场次开放情况为准。',
    source: 'https://apps.apple.com/cn/app/id1493894094',
  },
  {
    id: 'showstart',
    text: '关注官方票种、电子票和本场实名规则。',
    source: 'https://apps.apple.com/cn/app/id923912459',
  },
  {
    id: 'fenwandao',
    text: '核对本场是否开放优先购或官方候补。',
    source: 'https://apps.apple.com/cn/app/id1566835977',
  },
  {
    id: 'moretickets',
    text: '转售渠道与官方首发分开比较；核对总价、交付和转售限制。',
    source: 'https://www.moretickets.com/agreement/user-agreement?lang=zh-HK&type=agreement',
  },
  {
    id: 'hkticketing',
    text: '等待室自动放行，保留原会话，不主动刷新；购买时留意倒计时。',
    source: 'https://hkt.hkticketing.com/#/news/detail/0/42',
  },
  {
    id: 'cityline',
    text: '等候页自动重试；过密刷新和重复标签页可能干扰会话。',
    source: 'https://msg3.cityline.com/',
  },
  {
    id: 'urbtix',
    text: '以本场官方轮候与渠道说明为准。',
    source: 'https://www.info.gov.hk/gia/general/202211/29/P2022112900303.htm',
  },
  {
    id: 'ticketmaster',
    text: '按活动参与适用预售并保护排队会话；订单结账时限以当前页面为准。',
    source:
      'https://help.ticketmaster.com/hc/en-us/articles/9781366115985-What-is-the-queue-and-how-do-I-join',
  },
  {
    id: 'axs',
    text: '等候室早到不保证更好的顺位，重点是准时且保持会话。',
    source: 'https://support.axs.com/hc/en-us/articles/200745935-What-s-a-Waiting-Room',
  },
  {
    id: 'dice',
    text: '官方候补通常只登记一种票型，人数变化可能影响候补位置。',
    source: 'https://dice.fm/help/article?id=4409662022289',
  },
  {
    id: 'eventbrite',
    text: '候补放票由主办方选择并设定响应期限。',
    source: 'https://www.eventbrite.com/help/en-us/articles/817355/',
  },
  {
    id: 'seetickets',
    text: '排队方式随活动变化，历史场次的随机排位规则不能套用到所有活动。',
    source: 'https://www.glastonburyfestivals.co.uk/news/2025-ticket-sale-faq/',
  },
  {
    id: 'livenation',
    text: '核对会员预售资格；跳转票务平台的入口不必然是独立票池。',
    source:
      'https://help.livenation.com/hc/en-us/articles/36339165067153-How-do-I-unlock-access-to-Live-Nation-Presales',
  },
  {
    id: 'seatgeek',
    text: '既有部分一级票，也有转售商品；按具体挂牌区分。',
    source:
      'https://support.seatgeek.com/hc/en-us/articles/360012945394-What-is-the-secondary-ticket-market',
  },
  {
    id: 'stubhub',
    text: '卖家挂牌转售，与主办方原价首轮不同；核对交付、限制及实际总价。',
    source: 'https://support.stubhub.com/in/articles/61000276377-selling-tickets-on-stubhub',
  },
  {
    id: 'vividseats',
    text: '卖家定价的转售商品，需逐条核对总费用及交付。',
    source:
      'https://support.vividseats.com/support/solutions/articles/1000210417-how-are-ticket-prices-determined-',
  },
  {
    id: 'tickpick',
    text: '转售卖家决定票价；不计入官方首发成功率。',
    source:
      'https://support.tickpick.com/hc/en-us/articles/360007649773-Who-determines-the-price-of-tickets',
  },
  {
    id: 'klook',
    text: '核对即时或待确认、入场时段及是否还需预约。',
    source: 'https://www.klook.com/faq/category-14-question-910/',
  },
  {
    id: 'kkday',
    text: '部分订单需供应商确认；付款不等于最终入场资格。',
    source: 'https://www.kkday.com/static/zh-hk/about/TermsAndConditions.html',
  },
  {
    id: 'trip',
    text: '按具体产品核对日期、供应商确认和凭证。',
    source: 'https://www.trip.com/things-to-do',
  },
];
const timeText = (instant: string, zone = 'Asia/Shanghai') =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(instant));
const activeOrder = new Set<AttemptStatus>(['pending_payment', 'paid_pending_issue', 'issued']);

function StatusPill({ status }: { status: AttemptStatus }) {
  return (
    <span className={`status-pill ${activeOrder.has(status) ? 'positive' : ''}`}>
      {resultLabels[status]}
    </span>
  );
}

export default function App() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [editing, setEditing] = useState<EventRecord | true | null>(null);
  const [saleEditor, setSaleEditor] = useState<SaleOpportunity | true | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const [usb, setUsb] = useState('尚未检测');
  const selected = events.find((item) => item.id === selectedId) ?? null;
  const upcoming = useMemo(
    () =>
      events
        .flatMap((event) =>
          Date.parse(event.followUntil) < clock
            ? []
            : event.opportunities
                .filter(
                  (o) =>
                    Date.parse(o.startsAt) >= clock &&
                    o.status !== 'missed' &&
                    o.status !== 'completed',
                )
                .map((o) => ({ event, sale: o })),
        )
        .sort((a, b) => a.sale.startsAt.localeCompare(b.sale.startsAt)),
    [events, clock],
  );

  async function reload() {
    try {
      const data = await window.ticket.list();
      setEvents(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取本地数据失败');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    const unsubscribe = window.ticket.onChanged(() => {
      void reload();
    });
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, []);
  async function save(event: EventRecord) {
    const next = await window.ticket.save(event);
    await reload();
    setSelectedId(next.id);
    setPage('dashboard');
    setEditing(null);
    setSaleEditor(null);
  }
  async function mutate(event: EventRecord) {
    try {
      await save({ ...event, updatedAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  }
  async function remove() {
    if (!selected || !window.confirm(`删除「${selected.title}」及其本地记录？`)) return;
    try {
      await window.ticket.remove(selected.id);
      setSelectedId(null);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  }
  async function openOfficial(event: EventRecord, url = event.eventUrl) {
    try {
      await window.ticket.openOfficial(event.platform, url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法打开入口');
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Ticket size={23} />
          </div>
          <div>
            <strong>候票台</strong>
            <small>把机会准备好</small>
          </div>
        </div>
        <nav aria-label="主导航" className="nav">
          <button
            className={page === 'dashboard' ? 'active' : ''}
            onClick={() => {
              setPage('dashboard');
              setSelectedId(null);
            }}
          >
            <ListChecks size={18} /> 我的任务
          </button>
          <button
            className={page === 'calendar' ? 'active' : ''}
            onClick={() => {
              setPage('calendar');
              setSelectedId(null);
            }}
          >
            <CalendarDays size={18} /> 销售日历
          </button>
          <button
            className={page === 'guide' ? 'active' : ''}
            onClick={() => {
              setPage('guide');
              setSelectedId(null);
            }}
          >
            <ShieldCheck size={18} /> 平台规则
          </button>
          <button
            className={page === 'device' ? 'active' : ''}
            onClick={() => {
              setPage('device');
              setSelectedId(null);
            }}
          >
            <Smartphone size={18} /> Android 连接
          </button>
        </nav>
        <div className="side-note">
          <span className="note-dot" /> 官方流程辅助
          <br />
          <small>库存、排位和订单结果需人工确认</small>
        </div>
        <div className="side-foot">
          LOCAL FIRST <span>·</span> 数据只存在本机
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            购票工作台 <ChevronRight size={14} />{' '}
            {selected
              ? selected.title
              : page === 'calendar'
                ? '销售日历'
                : page === 'guide'
                  ? '平台规则'
                  : page === 'device'
                    ? 'Android 连接'
                    : '我的任务'}
          </span>
          <span className="local-badge">
            <ShieldCheck size={14} /> 本地保存
          </span>
        </header>
        <div className="content">
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => setError('')}>关闭</button>
            </div>
          )}
          {loading ? (
            <div className="empty">
              <div className="skeleton" />
              <div className="skeleton short" />
            </div>
          ) : selected ? (
            <EventDetail
              event={selected}
              onBack={() => setSelectedId(null)}
              onEdit={() => setEditing(selected)}
              onRemove={remove}
              onAddSale={() => setSaleEditor(true)}
              onEditSale={setSaleEditor}
              onMutate={mutate}
              onOpen={openOfficial}
            />
          ) : page === 'dashboard' ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR TICKETING DESK</span>
                  <h1>把每次机会，准备成一次有效尝试。</h1>
                  <p>记录固定场次和预算，提前检查资格与官方销售阶段。排队和下单仍在原平台完成。</p>
                </div>
                <button className="button primary" onClick={() => setEditing(true)}>
                  <Plus size={18} /> 新建任务
                </button>
              </div>
              <div className="summary-strip">
                <div>
                  <span>正在跟进</span>
                  <strong>{events.length.toString().padStart(2, '0')}</strong>
                  <small>个固定场次</small>
                </div>
                <div>
                  <span>接下来</span>
                  <strong>
                    {upcoming.length ? timeText(upcoming[0].sale.startsAt).slice(5, 16) : '—'}
                  </strong>
                  <small>
                    {upcoming.length ? saleLabels[upcoming[0].sale.type] : '暂无已确认机会'}
                  </small>
                </div>
                <div className="summary-advice">
                  <Info size={18} />
                  <span>
                    任务只提醒有来源的开售与候补机会。软件关闭期间无法推送桌面通知，请保留平台原生提醒。
                  </span>
                </div>
              </div>
              <div className="section-title list-title">
                <div>
                  <span className="eyebrow">TRACKED EVENTS</span>
                  <h2>我的购票任务</h2>
                </div>
                <span className="muted">优先按最近修改显示</span>
              </div>
              {events.length ? (
                <div className="event-list">
                  {events.map((event) => {
                    const next = event.opportunities
                      .filter((o) => Date.parse(o.startsAt) >= Date.now())
                      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
                    const completed = Object.values(event.checklist).filter(Boolean).length;
                    const last = event.attempts.at(-1);
                    return (
                      <button
                        className="event-row"
                        key={event.id}
                        onClick={() => setSelectedId(event.id)}
                      >
                        <div className="event-icon">
                          <Ticket size={21} />
                        </div>
                        <div className="event-primary">
                          <strong>{event.title}</strong>
                          <span>
                            {platformLabels[event.platform]} <i /> {event.venue || '场馆未填'} <i />{' '}
                            {timeText(event.sessionAt, event.timeZone)}
                          </span>
                        </div>
                        <div className="event-meta">
                          <span>
                            {next
                              ? `${saleLabels[next.type]} · ${timeText(next.startsAt, next.timeZone)}`
                              : '暂无已确认后续机会'}
                          </span>
                          <small>
                            准备 {completed}/8 {last ? `· ${resultLabels[last.status]}` : ''}
                          </small>
                        </div>
                        <ChevronRight size={19} className="muted" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty">
                  <div className="empty-icon">
                    <Ticket size={27} />
                  </div>
                  <h3>先从一场确定的演出开始</h3>
                  <p>
                    填入场次、人数、预算和官方规则来源，再补全销售时间。这里不会展示未经核实的库存。
                  </p>
                  <button className="button secondary" onClick={() => setEditing(true)}>
                    <Plus size={17} /> 创建第一个任务
                  </button>
                </div>
              )}
            </>
          ) : page === 'calendar' ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SALES & WAITLIST</span>
                  <h1>销售日历</h1>
                  <p>只显示你录入且附有来源的机会，时间同时保留活动所在地时区。</p>
                </div>
              </div>
              {upcoming.length ? (
                <div className="timeline big-timeline">
                  {upcoming.map(({ event, sale }) => (
                    <button
                      key={sale.id}
                      className="timeline-row"
                      onClick={() => {
                        setSelectedId(event.id);
                        setPage('dashboard');
                      }}
                    >
                      <div className="timeline-date">
                        <strong>{timeText(sale.startsAt).slice(5, 10)}</strong>
                        <small>{timeText(sale.startsAt).slice(11, 16)} 北京</small>
                      </div>
                      <div>
                        <span className="tag">{saleLabels[sale.type]}</span>
                        <h3>{event.title}</h3>
                        <small>
                          当地 {timeText(sale.startsAt, sale.timeZone)} · {sale.timeZone}
                        </small>
                        <p>
                          {sale.eligibility || '资格请以本场公告为准'} · 来源核实 {sale.verifiedAt}
                        </p>
                      </div>
                      <ArrowRight size={19} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <CalendarDays size={28} />
                  <h3>暂无已确认的未来机会</h3>
                  <p>在购票任务中添加官方优先购、公开销售、正式补票或候补公告。</p>
                </div>
              )}
            </>
          ) : page === 'guide' ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">PLATFORM NOTES</span>
                  <h1>平台规则与能力边界</h1>
                  <p>以下是通用提示。每个项目的官方公告和本场购票须知仍是最终依据。</p>
                </div>
              </div>
              <div className="guide-callout">
                <ShieldCheck size={22} />
                <div>
                  <strong>当前能力：规则、日历、人工决策与官方入口</strong>
                  <p>未接入平台实时库存、排队顺位或交易接口。未知能力不会显示为“已适配”。</p>
                </div>
              </div>
              <div className="guide-list">
                {guide.map((item) => (
                  <div className="guide-row" key={item.id}>
                    <div className="guide-platform">{platformLabels[item.id]}</div>
                    <p>{item.text}</p>
                    <small>资料来源：{new URL(item.source).hostname}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ANDROID BRIDGE</span>
                  <h1>连接 Android</h1>
                  <p>
                    通过 USB 检查设备，并在大麦 App 已安装时尝试唤起
                    App。活动选择和结账全程在手机上人工完成。
                  </p>
                </div>
              </div>
              <div className="device-panel">
                <div className="device-illustration">
                  <Smartphone size={54} />
                </div>
                <div>
                  <h2>USB 设备状态</h2>
                  <p className="preline">{usb}</p>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      onClick={async () => setUsb(await window.ticket.usbStatus())}
                    >
                      <Search size={17} /> 检查连接
                    </button>
                    <button
                      className="button ghost"
                      onClick={async () => setUsb(await window.ticket.launchDamai())}
                    >
                      <ExternalLink size={17} /> 尝试打开大麦
                    </button>
                  </div>
                </div>
              </div>
              <div className="guide-callout">
                <Info size={20} />
                <p>
                  需要 Android Platform Tools 的 adb、手机 USB 调试授权及大麦 App。没有 adb
                  时，仍可在 Windows
                  端管理任务、打开已验证的网址。这里不读取手机屏幕，也不模拟点击。
                </p>
              </div>
            </>
          )}
        </div>
      </main>
      {editing && (
        <EventForm
          initial={editing === true ? undefined : editing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}{' '}
      {saleEditor && selected && (
        <OpportunityForm
          event={selected}
          initial={saleEditor === true ? undefined : saleEditor}
          onClose={() => setSaleEditor(null)}
          onSave={async (item) => {
            const others = selected.opportunities.filter((o) => o.id !== item.id);
            await mutate({ ...selected, opportunities: [...others, item] });
            setSaleEditor(null);
          }}
        />
      )}
    </div>
  );
}

function EventDetail({
  event,
  onBack,
  onEdit,
  onRemove,
  onAddSale,
  onEditSale,
  onMutate,
  onOpen,
}: {
  event: EventRecord;
  onBack: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onAddSale: () => void;
  onEditSale: (value: SaleOpportunity) => void;
  onMutate: (value: EventRecord) => Promise<void>;
  onOpen: (event: EventRecord, url?: string) => Promise<void>;
}) {
  const [availability, setAvailability] = useState<Availability[]>(
    event.tiers.map(() => 'unknown'),
  );
  const [resultStatus, setResultStatus] = useState<AttemptStatus>('unknown');
  const [resultTier, setResultTier] = useState('');
  const [resultTotal, setResultTotal] = useState('');
  const [evidence, setEvidence] = useState('');
  const [resultNote, setResultNote] = useState('');
  const [resultOpportunity, setResultOpportunity] = useState('');
  const [followLocal, setFollowLocal] = useState(
    formatLocalInstant(event.followUntil, event.timeZone),
  );
  const latest = event.attempts.at(-1);
  const orderExists = Boolean(latest && activeOrder.has(latest.status));
  const decision = chooseTier(
    event.tiers,
    event.tiers.map((_, i) => availability[i] ?? 'unknown'),
    event.quantity,
    event.budget,
  );
  useEffect(
    () => setAvailability(event.tiers.map(() => 'unknown')),
    [event.id, event.tiers.length],
  );
  useEffect(
    () => setFollowLocal(formatLocalInstant(event.followUntil, event.timeZone)),
    [event.id, event.followUntil, event.timeZone],
  );
  useEffect(() => setResultOpportunity(''), [event.id]);
  function updateSale(item: SaleOpportunity, status: SaleOpportunity['status']) {
    void onMutate({
      ...event,
      opportunities: event.opportunities.map((o) => (o.id === item.id ? { ...o, status } : o)),
    });
  }
  async function addResult(e: FormEvent) {
    e.preventDefault();
    await onMutate({
      ...event,
      attempts: [
        ...event.attempts,
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          opportunityId: resultOpportunity || null,
          status: resultStatus,
          tier: resultTier.trim(),
          total: resultTotal === '' ? null : Number(resultTotal),
          evidence: evidence.trim(),
          note: resultNote.trim(),
        },
      ],
    });
    setResultTier('');
    setResultTotal('');
    setEvidence('');
    setResultNote('');
  }
  return (
    <>
      <button className="back-link" onClick={onBack}>
        ← 返回任务列表
      </button>
      <div className="detail-heading">
        <div>
          <span className="eyebrow">{platformLabels[event.platform]} · 固定场次</span>
          <h1>{event.title}</h1>
          <p>
            {event.venue || '场馆未填'} <span>·</span> {timeText(event.sessionAt, event.timeZone)}{' '}
            <span>·</span> {event.timeZone}
          </p>
        </div>
        <div className="button-row">
          <button className="button ghost" onClick={onEdit}>
            <Settings2 size={17} /> 编辑规则
          </button>
          <button
            className="button primary"
            onClick={() => void onOpen(event)}
            disabled={!event.eventUrl}
          >
            <ExternalLink size={17} /> 打开官方网页
          </button>
        </div>
      </div>
      <div className="metric-bar">
        <div>
          <span>固定人数</span>
          <strong>{event.quantity} 人</strong>
        </div>
        <div>
          <span>总预算上限</span>
          <strong>
            {event.budget.toLocaleString()} {event.currency}
          </strong>
        </div>
        <div>
          <span>购买负责人</span>
          <strong>{event.owner || '未指定'}</strong>
        </div>
        <div>
          <span>最新结果</span>
          {latest ? (
            <StatusPill status={latest.status} />
          ) : (
            <strong className="muted">尚未尝试</strong>
          )}
        </div>
      </div>
      <div className="detail-grid">
        <div className="detail-column">
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">01 / OPPORTUNITIES</span>
                <h2>官方销售机会</h2>
              </div>
              <button className="text-button" onClick={onAddSale}>
                <Plus size={16} /> 添加机会
              </button>
            </div>
            {event.opportunities.length ? (
              <div className="opportunity-list">
                {[...event.opportunities]
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                  .map((item) => (
                    <div className="opportunity" key={item.id}>
                      <div className="opportunity-head">
                        <span className="tag">{saleLabels[item.type]}</span>
                        <span className="opportunity-time">
                          {timeText(item.startsAt, item.timeZone)}
                        </span>
                      </div>
                      <small>
                        {item.timeZone} · 来源核实 {item.verifiedAt}
                      </small>
                      <p>
                        {item.eligibility || '资格以本场公告为准'}
                        {item.note ? ` · ${item.note}` : ''}
                      </p>
                      {item.endsAt && <small>截止：{timeText(item.endsAt, item.timeZone)}</small>}
                      <div className="opportunity-actions">
                        <select
                          aria-label={`${saleLabels[item.type]}参与状态`}
                          value={item.status}
                          onChange={(e) =>
                            updateSale(item, e.target.value as SaleOpportunity['status'])
                          }
                        >
                          <option value="planned">计划参加</option>
                          <option value="registered">已登记 / 参与</option>
                          <option value="completed">已结束</option>
                          <option value="missed">已错过</option>
                        </select>
                        {item.url && (
                          <button
                            className="text-button"
                            onClick={() => void onOpen(event, item.url)}
                          >
                            <ExternalLink size={14} /> 官方入口
                          </button>
                        )}
                        <button className="text-button" onClick={() => onEditSale(item)}>
                          编辑
                        </button>
                        <button
                          className="text-button danger"
                          onClick={() => {
                            if (window.confirm('删除这条销售机会？'))
                              void onMutate({
                                ...event,
                                opportunities: event.opportunities.filter((o) => o.id !== item.id),
                              });
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="quiet-empty">
                还没有有来源的销售时间。添加官方公告后才会出现在日历和提醒中。
              </p>
            )}
            <p className="help-note">
              <Bell size={15} /> 仅应用运行时提醒；候补邀请请同时开启官方 App 通知。
            </p>
          </section>
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">02 / READINESS</span>
                <h2>开售前检查</h2>
              </div>
              <span className="counter">
                {Object.values(event.checklist).filter(Boolean).length} / 8
              </span>
            </div>
            <div className="checklist">
              {(Object.keys(checklistLabels) as (keyof typeof event.checklist)[]).map((key) => (
                <label className="check-row" key={key}>
                  <input
                    type="checkbox"
                    checked={event.checklist[key]}
                    onChange={(e) =>
                      void onMutate({
                        ...event,
                        checklist: { ...event.checklist, [key]: e.target.checked },
                      })
                    }
                  />
                  <span className="custom-check">
                    <Check size={14} />
                  </span>
                  <span>{checklistLabels[key]}</span>
                </label>
              ))}
            </div>
            <p className="help-note">只记录已核实项。证件号、账号密码和支付凭据不要输入本工具。</p>
          </section>
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">03 / TICKET CHOICE</span>
                <h2>票档决策卡</h2>
              </div>
              <span className="muted">人工标记页面状态</span>
            </div>
            <p className="panel-intro">
              排序已固定。只在官方选票页面判断，候补登记按该平台原生规则单独处理。
            </p>
            <div className="tier-list">
              {event.tiers.map((tier, i) => (
                <div className="tier-row" key={i}>
                  <span className="tier-letter">{String.fromCharCode(65 + i)}</span>
                  <div>
                    <strong>{tier.label}</strong>
                    <small>
                      {tier.unitPrice === null
                        ? '参考单价未知'
                        : `${tier.unitPrice.toLocaleString()} ${event.currency} / 张`}
                    </small>
                  </div>
                  <select
                    aria-label={`${tier.label}页面状态`}
                    value={availability[i] ?? 'unknown'}
                    onChange={(e) =>
                      setAvailability(
                        availability.map((value, n) =>
                          n === i ? (e.target.value as Availability) : value,
                        ),
                      )
                    }
                  >
                    <option value="unknown">页面未知</option>
                    <option value="available">人工确认可选</option>
                    <option value="sold_out">人工确认不可选</option>
                  </select>
                </div>
              ))}
            </div>
            <div className={`decision ${orderExists ? 'decision-quiet' : ''}`}>
              <strong>
                {orderExists
                  ? '已有待完成或已确认订单'
                  : decision.kind === 'recommend'
                    ? `建议先核对 ${event.tiers[decision.index].label}`
                    : decision.kind === 'uncertain'
                      ? '状态未明，先确认页面'
                      : decision.kind === 'check_total'
                        ? '先核对实际总额'
                        : decision.kind === 'over_budget'
                          ? '当前可选票超出预算'
                          : '暂无可买票档'}
              </strong>
              <p>{orderExists ? '优先完成已有订单，不继续提交新单。' : decision.note}</p>
            </div>
          </section>
        </div>
        <div className="detail-column">
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">SOURCE OF TRUTH</span>
                <h2>本场规则</h2>
              </div>
              <Link2 size={18} className="muted" />
            </div>
            <p className="rule-note">
              {event.ruleNote || '尚未摘录本场限制；请阅读官方项目页面并补充。'}
            </p>
            <div className="source-box">
              <small>核实 {event.verifiedAt}</small>
              <span title={event.sourceUrl}>{event.sourceUrl}</span>
            </div>
            <div className="capability-note">
              <ShieldCheck size={18} />
              <p>
                可用：官方入口、日历、清单、人工选择和结果记录。
                <br />
                未接入：实时库存、自动排队、自动提交。
              </p>
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">04 / OUTCOME</span>
                <h2>购票结果记录</h2>
              </div>
            </div>
            <p className="panel-intro">
              点击、占票、待支付和出票不是同一个结果，请按官方凭据手动记录。
            </p>
            <form onSubmit={addResult} className="result-form">
              <label>
                对应销售机会
                <select
                  value={resultOpportunity}
                  onChange={(e) => setResultOpportunity(e.target.value)}
                >
                  <option value="">未指定 / 后续人工处理</option>
                  {event.opportunities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {saleLabels[item.type]} · {timeText(item.startsAt, item.timeZone)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                当前阶段
                <select
                  value={resultStatus}
                  onChange={(e) => setResultStatus(e.target.value as AttemptStatus)}
                >
                  {Object.entries(resultLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  票档
                  <input
                    value={resultTier}
                    onChange={(e) => setResultTier(e.target.value)}
                    placeholder="选填"
                  />
                </label>
                <label>
                  实付总额
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={resultTotal}
                    onChange={(e) => setResultTotal(e.target.value)}
                    placeholder="选填"
                  />
                </label>
              </div>
              <label>
                确认依据
                <input
                  required={activeOrder.has(resultStatus)}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="例如：官方订单号后四位（勿填完整证件）"
                />
              </label>
              <label>
                备注
                <textarea
                  rows={2}
                  value={resultNote}
                  onChange={(e) => setResultNote(e.target.value)}
                  placeholder="失败原因、截止时间或需要人工处理的事项"
                />
              </label>
              <button className="button secondary" type="submit">
                <Plus size={16} /> 记录当前结果
              </button>
            </form>
            {event.attempts.length ? (
              <div className="journal">
                {[...event.attempts].reverse().map((attempt) => (
                  <div className="journal-row" key={attempt.id}>
                    <div className="journal-dot" />
                    <div>
                      <div>
                        <StatusPill status={attempt.status} />
                        <small>{timeText(attempt.at)}</small>
                      </div>
                      <p>
                        {[
                          attempt.opportunityId
                            ? saleLabels[
                                event.opportunities.find((o) => o.id === attempt.opportunityId)
                                  ?.type ?? 'public'
                              ]
                            : '',
                          attempt.tier,
                          attempt.total === null ? '' : `${attempt.total} ${event.currency}`,
                          attempt.note,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '人工记录'}
                      </p>
                      {attempt.evidence && <small>依据：{attempt.evidence}</small>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="quiet-empty">尚无尝试记录。失败和结果未知也值得保存。</p>
            )}
          </section>
          <section className="panel subtle-panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">FOLLOW UP</span>
                <h2>后续机会</h2>
              </div>
            </div>
            <p>
              默认跟进到演出开始。没有官方补票或候补来源时，状态保持“暂无已确认后续机会”，不预测整点回流。
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const at = parseLocalInstant(followLocal, event.timeZone);
                  if (at > event.sessionAt) throw new Error('跟进截止不能晚于演出开始');
                  void onMutate({ ...event, followUntil: at });
                } catch {
                  window.alert('请输入有效的截止时间，且不能晚于演出开始。');
                }
              }}
            >
              <label>
                跟进截止（活动所在地时间）
                <input
                  type="datetime-local"
                  value={followLocal}
                  onChange={(e) => setFollowLocal(e.target.value)}
                />
              </label>
              <button className="text-button" type="submit">
                保存跟进截止
              </button>
            </form>
            <button className="text-button danger" onClick={onRemove}>
              <Trash2 size={15} /> 删除本地任务
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
