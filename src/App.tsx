import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
  Moon,
  Sun,
  Ticket,
  Trash2,
} from 'lucide-react';
import { EventForm } from './components/EventForm';
import { DiscoverPage } from './components/DiscoverPage';
import { OpportunityForm } from './components/OpportunityForm';
import type { DiscoveredEvent } from '../shared/discovery';
import { planActions } from '../shared/action-plan';
import { marketComparisons } from '../shared/market';
import {
  createEventMutationQueue,
  mergeRuleEdit,
  removeSaleKeepingResults,
} from './event-mutation';
import {
  chooseTier,
  effectivePurchaseChannel,
  formatLocalInstant,
  hasOpenOrder,
  lastPerformanceAt,
  parseLocalInstant,
  pendingPaymentAttempts,
} from '../shared/rules';
import {
  checklistLabels,
  platformLabels,
  purchaseChannelLabels,
  resultLabels,
  saleLabels,
  type AttemptStatus,
  type Availability,
  type EventRecord,
  type PlatformId,
  type SaleOpportunity,
} from '../shared/model';

type Page = 'dashboard' | 'discover' | 'calendar' | 'guide' | 'device';
type DetailTab = 'sales' | 'ready' | 'tickets' | 'results';
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
const sessionSummary = (event: EventRecord) =>
  event.sessions?.length
    ? `${event.sessions.length} 场 · ${event.sessions[0].local.slice(0, 10)}—${event.sessions.at(-1)!.local.slice(0, 10)}`
    : timeText(event.sessionAt, event.timeZone);
const activeOrder = new Set<AttemptStatus>(['pending_payment', 'paid_pending_issue', 'issued']);

function StatusPill({ status }: { status: AttemptStatus }) {
  return (
    <span className={`status-pill ${activeOrder.has(status) ? 'positive' : ''}`}>
      {resultLabels[status]}
    </span>
  );
}

export default function App() {
  const web = window.ticket.environment === 'web';
  const mutationQueue = useMemo(() => createEventMutationQueue(window.ticket), []);
  const pendingMutations = useRef(0);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailStartTab, setDetailStartTab] = useState<DetailTab>('sales');
  const [page, setPage] = useState<Page>('discover');
  const [editing, setEditing] = useState<EventRecord | true | null>(null);
  const [discoverySeed, setDiscoverySeed] = useState<DiscoveredEvent | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeOpportunityId, setActiveOpportunityId] = useState<string | null>(null);
  const [saleEditor, setSaleEditor] = useState<SaleOpportunity | true | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [recovered, setRecovered] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );
  const [clock, setClock] = useState(Date.now());
  const [usb, setUsb] = useState('尚未检测');
  const [browserPlatform, setBrowserPlatform] = useState<PlatformId>('damai');
  const [browserDataStatus, setBrowserDataStatus] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [query, setQuery] = useState('');
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
                    Date.parse(o.startsAt) >= clock - 2 * 60 * 60 * 1000 &&
                    o.status !== 'missed' &&
                    o.status !== 'completed',
                )
                .map((o) => ({ event, sale: o })),
        )
        .sort((a, b) => a.sale.startsAt.localeCompare(b.sale.startsAt)),
    [events, clock],
  );
  const nextActions = useMemo(() => planActions(events, clock), [events, clock]);
  const [mobileActionMessage, setMobileActionMessage] = useState('');

  async function launchDamaiForTask(): Promise<string> {
    try {
      const result = await window.ticket.launchDamai();
      setMobileActionMessage(result);
      return result;
    } catch (cause) {
      const result = cause instanceof Error ? cause.message : '无法打开手机大麦';
      setMobileActionMessage(result);
      return result;
    }
  }

  function openEvent(id: string, tab: DetailTab = 'sales') {
    setMobileActionMessage('');
    setDetailStartTab(tab);
    setSelectedId(id);
    setPage('dashboard');
  }

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
    void window.ticket.setTheme(theme);
    void window.ticket
      .recoveryStatus()
      .then(setRecovered)
      .catch(() => {});
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    const unsubscribe = window.ticket.onChanged(() => {
      if (pendingMutations.current === 0) void reload();
    });
    const unsubscribeDiscovery = window.ticket.onDiscovered((discovered) => {
      setSelectedId(null);
      setPage('discover');
      setDiscoverySeed(discovered);
      setEditing(true);
    });
    return () => {
      window.clearInterval(timer);
      unsubscribe();
      unsubscribeDiscovery();
    };
  }, []);
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('ticket-theme', next);
    } catch {
      // Theme remains usable for this session even when storage is unavailable.
    }
    void window.ticket.setTheme(next);
  }
  async function startOfficialPurchase(event: EventRecord) {
    try {
      if (effectivePurchaseChannel(event) === 'app_required') {
        openEvent(event.id, 'tickets');
        const message =
          event.platform === 'damai' && !web
            ? await launchDamaiForTask()
            : '请在手机手动打开该场指定的官方 App，并在原平台核对票档和人数。';
        setMobileActionMessage(message);
        return;
      }
      if (!event.eventUrl) throw new Error('当前任务没有可用的官方网页入口');
      if (web) {
        await window.ticket.openInside(event.id);
        return;
      }
      await window.ticket.discover(event.platform, event.eventUrl);
      setActiveTaskId(event.id);
      setActiveOpportunityId(null);
      setSelectedId(null);
      setPage('discover');
    } catch (cause) {
      openEvent(event.id, 'tickets');
      setError(
        `任务已保存，但打开官方入口失败：${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }

  async function save(event: EventRecord, startNow = false) {
    if (events.some((item) => item.id === event.id)) {
      pendingMutations.current++;
      try {
        const next = await mutationQueue(event.id, (current) => mergeRuleEdit(current, event));
        openEvent(next.id);
        setEditing(null);
        setDiscoverySeed(null);
        setSaleEditor(null);
        if (startNow) await startOfficialPurchase(next);
      } finally {
        pendingMutations.current--;
        if (pendingMutations.current === 0) await reload();
      }
    } else {
      const next = await window.ticket.save(event);
      await reload();
      openEvent(next.id);
      setEditing(null);
      setDiscoverySeed(null);
      setSaleEditor(null);
      if (startNow) await startOfficialPurchase(next);
    }
  }
  async function mutate(update: (current: EventRecord) => EventRecord): Promise<boolean> {
    const eventId = selected?.id;
    if (!eventId) {
      setError('任务已不存在，请返回列表重新选择');
      return false;
    }
    pendingMutations.current++;
    setEvents((current) => current.map((item) => (item.id === eventId ? update(item) : item)));
    try {
      await mutationQueue(eventId, update);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
      return false;
    } finally {
      pendingMutations.current--;
      if (pendingMutations.current === 0) await reload();
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
  async function openInside(eventId: string, opportunityId?: string) {
    try {
      const task = events.find((item) => item.id === eventId);
      if (!task) throw new Error('任务已不存在');
      const sale = opportunityId
        ? task.opportunities.find((item) => item.id === opportunityId)
        : undefined;
      if (opportunityId && !sale) throw new Error('销售机会已不存在');
      const url = sale?.url || task.eventUrl;
      if (!url) throw new Error('本场尚未设置官方网页入口');
      if (web) {
        await window.ticket.openInside(eventId, opportunityId);
        return;
      }
      await window.ticket.discover(task.platform, url);
      setActiveTaskId(eventId);
      setActiveOpportunityId(opportunityId ?? null);
      setSelectedId(null);
      setPage('discover');
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法打开内置网页');
    }
  }
  async function openReference(eventId: string, opportunityId?: string) {
    try {
      await window.ticket.openReference(eventId, opportunityId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法打开规则来源');
    }
  }
  async function openKnowledgeSource(id: string) {
    try {
      await window.ticket.openKnowledgeSource(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法打开资料来源');
    }
  }
  async function downloadWebBackup() {
    try {
      const raw = await window.ticket.exportBackup?.();
      if (!raw) throw new Error('当前版本不支持导出');
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `候票台-网页备份-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setBackupStatus('备份已下载。请妥善保管文件，其中包含你的任务与备注。');
    } catch (cause) {
      setBackupStatus(cause instanceof Error ? cause.message : '下载备份失败');
    }
  }
  async function restoreWebBackup(file: File) {
    if (!window.confirm('导入会覆盖当前浏览器中的全部候票台任务。请先下载现有备份，确定继续吗？'))
      return;
    try {
      const count = await window.ticket.importBackup?.(await file.text());
      if (count === undefined) throw new Error('当前版本不支持导入');
      await reload();
      setBackupStatus(`已恢复 ${count} 个任务。`);
    } catch (cause) {
      setBackupStatus(cause instanceof Error ? cause.message : '导入备份失败');
    }
  }
  const visibleEvents = events.filter((event) =>
    `${event.title} ${event.venue} ${platformLabels[event.platform]}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const discoverySetup =
    editing === true && discoverySeed ? (
      <EventForm
        key={discoverySeed.eventUrl}
        seed={discoverySeed}
        presentation="panel"
        onSave={save}
        onLaunchApp={() =>
          web
            ? Promise.resolve('网页版本不能启动手机 App，请在手机上打开本场指定的官方 App。')
            : launchDamaiForTask()
        }
        onClose={() => {
          setEditing(null);
          setDiscoverySeed(null);
        }}
      />
    ) : null;

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
            className={page === 'discover' && !selected ? 'active' : ''}
            onClick={() => {
              setPage('discover');
              setSelectedId(null);
              setActiveTaskId(null);
              setActiveOpportunityId(null);
            }}
          >
            <Search size={18} /> 找票
          </button>
          <button
            className={page === 'dashboard' || page === 'calendar' ? 'active' : ''}
            onClick={() => {
              setPage('dashboard');
              setSelectedId(null);
            }}
          >
            <ListChecks size={18} /> 任务
          </button>
          <button
            className={page === 'guide' || page === 'device' ? 'active' : ''}
            onClick={() => {
              setPage('device');
              setSelectedId(null);
            }}
          >
            <Settings2 size={18} /> 设置
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
              : page === 'discover'
                ? '找票'
                : page === 'dashboard' || page === 'calendar'
                  ? '任务'
                  : '设置'}
          </span>
          <div className="topbar-actions">
            <button
              className="appearance-toggle"
              aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
              title={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <span className="local-badge">
              <ShieldCheck size={14} /> 本地保存
            </span>
          </div>
        </header>
        <div className="content">
          {recovered && (
            <div className="recovery-banner" role="alert">
              <ShieldCheck size={19} />
              <span>
                主数据库未能读取，已从本机备份载入任务。请核对最近的修改；下次保存将修复主文件。
              </span>
            </div>
          )}
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
              clock={clock}
              initialTab={detailStartTab}
              onBack={() => setSelectedId(null)}
              onEdit={() => setEditing(selected)}
              onRemove={remove}
              onAddSale={() => setSaleEditor(true)}
              onEditSale={setSaleEditor}
              onMutate={mutate}
              onOpen={openOfficial}
              onOpenInside={openInside}
              onLaunchDamai={launchDamaiForTask}
              phoneLaunchMessage={mobileActionMessage}
              onReference={openReference}
            />
          ) : page === 'discover' ? (
            <DiscoverPage
              web={web}
              suspended={Boolean(editing && !discoverySetup)}
              setupOpen={Boolean(discoverySetup)}
              setupPanel={discoverySetup}
              activeTask={events.find((item) => item.id === activeTaskId) ?? null}
              activeOpportunity={
                events
                  .find((item) => item.id === activeTaskId)
                  ?.opportunities.find((item) => item.id === activeOpportunityId) ?? null
              }
              onReturnToTask={() => {
                if (activeTaskId) openEvent(activeTaskId);
              }}
              onClearTask={() => {
                setActiveTaskId(null);
                setActiveOpportunityId(null);
              }}
              onDiscovered={(discovered) => {
                setDiscoverySeed(discovered);
                setEditing(true);
              }}
            />
          ) : page === 'dashboard' ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>任务</h1>
                  <p>按下一步时间整理你的购票准备。</p>
                </div>
                <div className="button-row">
                  <div className="view-switch" role="tablist" aria-label="任务视图">
                    <button role="tab" aria-selected="true">
                      列表
                    </button>
                    <button role="tab" aria-selected="false" onClick={() => setPage('calendar')}>
                      按时间
                    </button>
                  </div>
                  <button className="button secondary" onClick={() => setPage('discover')}>
                    <Search size={18} /> 找演出
                  </button>
                </div>
              </div>
              {nextActions[0] && (
                <section
                  className={`task-priority${nextActions[0].kind === 'payment' ? ' urgent' : ''}`}
                  aria-label="当前最重要的操作"
                >
                  <div>
                    <span>{nextActions[0].kind === 'payment' ? '优先处理' : '下一步'}</span>
                    <strong>{nextActions[0].title}</strong>
                    <small>
                      {nextActions[0].eventTitle} · {nextActions[0].detail}
                    </small>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => openEvent(nextActions[0].eventId, nextActions[0].target)}
                  >
                    {nextActions[0].kind === 'payment' ? '处理订单' : '继续准备'}
                    <ArrowRight size={16} />
                  </button>
                </section>
              )}
              <div className="section-title list-title">
                <div>
                  <h2>全部任务</h2>
                </div>
                <label className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="搜索购票任务"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索演出、城市或平台"
                  />
                </label>
              </div>
              {visibleEvents.length ? (
                <div className="event-list">
                  {visibleEvents.map((event) => {
                    const next = event.opportunities
                      .filter((o) => Date.parse(o.startsAt) >= Date.now())
                      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
                    const completed = Object.values(event.checklist).filter(Boolean).length;
                    const last = event.attempts.at(-1);
                    return (
                      <button
                        className="event-row"
                        key={event.id}
                        onClick={() => openEvent(event.id)}
                      >
                        <div className="event-icon">
                          <Ticket size={21} />
                        </div>
                        <div className="event-primary">
                          <strong>{event.title}</strong>
                          <span>
                            {platformLabels[event.platform]} <i /> {event.venue || '场馆未填'} <i />{' '}
                            {sessionSummary(event)}
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
                  <h3>{events.length ? '没有匹配的购票任务' : '先从一场确定的演出开始'}</h3>
                  <p>搜索演出后选择场次、票档和人数，其余资料会尽量自动带入。</p>
                  {!events.length && (
                    <button className="button primary" onClick={() => setPage('discover')}>
                      <Search size={17} /> 搜索第一场演出
                    </button>
                  )}
                </div>
              )}
            </>
          ) : page === 'calendar' ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>任务</h1>
                  <p>只显示你录入且附有来源的机会，时间同时保留活动所在地时区。</p>
                </div>
                <div className="view-switch" role="tablist" aria-label="任务视图">
                  <button role="tab" aria-selected="false" onClick={() => setPage('dashboard')}>
                    列表
                  </button>
                  <button role="tab" aria-selected="true">
                    按时间
                  </button>
                </div>
              </div>
              {upcoming.length ? (
                <div className="timeline big-timeline">
                  {upcoming.map(({ event, sale }) => (
                    <button
                      key={sale.id}
                      className="timeline-row"
                      onClick={() => {
                        openEvent(event.id);
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
              <div className="settings-switch" role="tablist" aria-label="设置类别">
                <button role="tab" aria-selected="false" onClick={() => setPage('device')}>
                  {web ? '应用与数据' : '手机与数据'}
                </button>
                <button role="tab" aria-selected="true">
                  平台说明
                </button>
              </div>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">PLATFORM NOTES</span>
                  <h1>设置</h1>
                  <p>平台说明 · 每个项目的官方公告和购票须知仍是最终依据。</p>
                </div>
              </div>
              <div className="guide-callout">
                <ShieldCheck size={22} />
                <div>
                  <strong>当前能力：任务、日历、人工决策与官方网页入口</strong>
                  <p>
                    未接入实时库存、排队顺位或自动交易。
                    {web
                      ? '浏览器版会在新标签页打开官方入口；任务只保存在当前浏览器。部分平台可能要求原生 App。'
                      : '内置网页的登录会话独立于系统浏览器；部分平台可能要求原生 App。'}
                  </p>
                </div>
              </div>
              <section className="comparison-section" aria-label="同类工具能力对照">
                <div className="section-title">
                  <div>
                    <span className="eyebrow">CAPABILITY MAP</span>
                    <h2>与同类工具怎么配合</h2>
                  </div>
                </div>
                <p className="comparison-intro">
                  原生平台负责售票、候补和交易；发现工具负责新活动提醒。候票台负责把你的固定条件、已核实机会与结果放在一起。
                </p>
                <div className="comparison-grid">
                  {marketComparisons.map((item) => (
                    <article className="comparison-card" key={item.id}>
                      <span className="eyebrow">{item.category}</span>
                      <h3>{item.product}</h3>
                      <p>
                        <strong>对方擅长</strong>
                        {item.strength}
                      </p>
                      <p>
                        <strong>候票台作用</strong>
                        {item.ourRole}
                      </p>
                      <p>
                        <strong>当前局限</strong>
                        {item.gap}
                      </p>
                      <div className="comparison-tip">{item.recommendation}</div>
                      <button
                        className="text-button"
                        onClick={() => void openKnowledgeSource(item.id)}
                      >
                        查看官方资料 <ExternalLink size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
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
          ) : web ? (
            <>
              <div className="settings-switch" role="tablist" aria-label="设置类别">
                <button role="tab" aria-selected="true">
                  应用与数据
                </button>
                <button role="tab" aria-selected="false" onClick={() => setPage('guide')}>
                  平台说明
                </button>
              </div>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">WEB EDITION</span>
                  <h1>设置</h1>
                  <p>任务保存在当前浏览器的本地站点数据中，不会同步到 Windows 桌面版。</p>
                </div>
              </div>
              <div className="guide-callout">
                <Info size={20} />
                <p>
                  官方购票入口会在新标签页打开。浏览器版没有内置网页会话、桌面提醒或 Android USB
                  功能。请保留官方 App 通知，并定期备份重要任务信息；清除浏览器站点数据会删除任务。
                </p>
              </div>
              <div className="device-panel session-panel">
                <div className="device-illustration">
                  <ShieldCheck size={40} />
                </div>
                <div>
                  <h2>通知与数据</h2>
                  <p>备份只包含候票台任务。导入前会校验全部记录，再一次性替换当前浏览器的数据。</p>
                  <div className="button-row">
                    <button
                      className="button ghost"
                      onClick={() => {
                        setDiscoverySeed(null);
                        setEditing(true);
                      }}
                    >
                      <Plus size={16} /> 手工录入任务
                    </button>
                    <button className="button secondary" onClick={() => void downloadWebBackup()}>
                      下载任务备份
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => document.getElementById('web-backup-file')?.click()}
                    >
                      导入备份
                    </button>
                    <input
                      id="web-backup-file"
                      hidden
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void restoreWebBackup(file);
                      }}
                    />
                  </div>
                  {backupStatus && <p role="status">{backupStatus}</p>}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="settings-switch" role="tablist" aria-label="设置类别">
                <button role="tab" aria-selected="true">
                  手机与数据
                </button>
                <button role="tab" aria-selected="false" onClick={() => setPage('guide')}>
                  平台说明
                </button>
              </div>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ANDROID BRIDGE</span>
                  <h1>设置</h1>
                  <p>
                    Android 手机可经 USB 打开已验证的原生
                    App，或发送官方网页链接；两种入口按本场规则区分。iPhone 请使用 Apple Devices
                    检查连接。活动选择和结账在手机上完成。
                  </p>
                </div>
              </div>
              <div className="device-panel">
                <div className="device-illustration">
                  <Smartphone size={54} />
                </div>
                <div>
                  <h2>手机连接</h2>
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
                      <ExternalLink size={17} /> 打开大麦 App
                    </button>
                  </div>
                </div>
              </div>
              <div className="guide-callout">
                <Info size={20} />
                <p>
                  vivo、OPPO、华为、小米和三星等 Android 手机使用相同的 ADB 连接方式，但 USB 调试和
                  Windows 驱动设置因机型而异。iPhone 不支持 ADB，也不能通过此按钮远程启动购票
                  App。这里不读取屏幕或模拟点击。
                </p>
              </div>
              <div className="button-row device-help-actions">
                <button
                  className="button ghost"
                  onClick={() => void window.ticket.openDeviceHelp('android')}
                >
                  Google 官方 Platform Tools <ExternalLink size={16} />
                </button>
                <button
                  className="button ghost"
                  onClick={() => void window.ticket.openDeviceHelp('iphone')}
                >
                  Apple 官方连接说明 <ExternalLink size={16} />
                </button>
              </div>
              <p className="help-note">
                下载 Google Platform Tools 后，把压缩包内的 <code>platform-tools</code> 文件夹解压到
                <code>%LOCALAPPDATA%\ticket-window-tools\</code>，再点击“检查连接”。
              </p>
              <div className="device-panel session-panel">
                <div className="device-illustration">
                  <ShieldCheck size={40} />
                </div>
                <div>
                  <h2>官方会话</h2>
                  <p>
                    每个平台在本机使用独立的网页登录会话。清除后需重新登录，当前排队或结账页面不能继续使用。
                  </p>
                  <div className="button-row">
                    <label className="session-select">
                      选择平台
                      <select
                        value={browserPlatform}
                        onChange={(e) => {
                          setBrowserPlatform(e.target.value as PlatformId);
                          setBrowserDataStatus('');
                        }}
                      >
                        {(Object.keys(platformLabels) as PlatformId[])
                          .filter((platform) => platform !== 'other')
                          .map((platform) => (
                            <option key={platform} value={platform}>
                              {platformLabels[platform]}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      className="button ghost"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `清除 ${platformLabels[browserPlatform]} 在候票台内置网页中的登录和缓存数据？`,
                          )
                        )
                          return;
                        try {
                          await window.ticket.clearBrowserData(browserPlatform);
                          setBrowserDataStatus('已清除。再次打开该平台的内置网页时需要重新登录。');
                        } catch (e) {
                          setBrowserDataStatus(e instanceof Error ? e.message : '清除失败');
                        }
                      }}
                    >
                      <Trash2 size={16} /> 清除该平台网页数据
                    </button>
                  </div>
                  {browserDataStatus && <p role="status">{browserDataStatus}</p>}
                </div>
              </div>
              <div className="device-panel session-panel">
                <div className="device-illustration">
                  <Bell size={40} />
                </div>
                <div>
                  <h2>通知与数据</h2>
                  <p>
                    任务与官方网页登录数据只保存在本机。候票台运行时提醒已确认的销售机会；关闭后请依靠平台原生通知。
                  </p>
                  <button
                    className="button ghost"
                    onClick={() => {
                      setDiscoverySeed(null);
                      setEditing(true);
                    }}
                  >
                    <Plus size={16} /> 手工录入任务
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      {editing && !discoverySetup && (
        <EventForm
          key={editing === true ? (discoverySeed?.eventUrl ?? 'new-event') : editing.id}
          initial={editing === true ? undefined : editing}
          seed={editing === true ? (discoverySeed ?? undefined) : undefined}
          onSave={save}
          onLaunchApp={() =>
            web
              ? Promise.resolve('网页版本不能启动手机 App，请在手机上打开本场指定的官方 App。')
              : launchDamaiForTask()
          }
          onClose={() => {
            setEditing(null);
            setDiscoverySeed(null);
          }}
        />
      )}{' '}
      {saleEditor && selected && (
        <OpportunityForm
          event={selected}
          initial={saleEditor === true ? undefined : saleEditor}
          onClose={() => setSaleEditor(null)}
          onSave={async (item) => {
            if (
              await mutate((current) => ({
                ...current,
                opportunities: [...current.opportunities.filter((o) => o.id !== item.id), item],
              }))
            )
              setSaleEditor(null);
          }}
        />
      )}
    </div>
  );
}

function EventDetail({
  event,
  clock,
  initialTab,
  onBack,
  onEdit,
  onRemove,
  onAddSale,
  onEditSale,
  onMutate,
  onOpen,
  onOpenInside,
  onLaunchDamai,
  phoneLaunchMessage,
  onReference,
}: {
  event: EventRecord;
  clock: number;
  initialTab: DetailTab;
  onBack: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onAddSale: () => void;
  onEditSale: (value: SaleOpportunity) => void;
  onMutate: (update: (current: EventRecord) => EventRecord) => Promise<boolean>;
  onOpen: (event: EventRecord, url?: string) => Promise<void>;
  onOpenInside: (eventId: string, opportunityId?: string) => Promise<void>;
  onLaunchDamai: () => Promise<string>;
  phoneLaunchMessage: string;
  onReference: (eventId: string, opportunityId?: string) => Promise<void>;
}) {
  const [availability, setAvailability] = useState<Availability[]>(
    event.tiers.map(() => 'unknown'),
  );
  const [resultStatus, setResultStatus] = useState<AttemptStatus>('unknown');
  const [resultTier, setResultTier] = useState('');
  const [resultTotal, setResultTotal] = useState('');
  const [resultDeadlineLocal, setResultDeadlineLocal] = useState('');
  const [resultError, setResultError] = useState('');
  const [phoneStatus, setPhoneStatus] = useState('');
  const [resultBusy, setResultBusy] = useState(false);
  const resultSubmitting = useRef(false);
  const [evidence, setEvidence] = useState('');
  const [resultNote, setResultNote] = useState('');
  const [resultOpportunity, setResultOpportunity] = useState('');
  const [followLocal, setFollowLocal] = useState(
    formatLocalInstant(event.followUntil, event.timeZone),
  );
  const [detailTab, setDetailTab] = useState<DetailTab>(initialTab);
  const latest = event.attempts.at(-1);
  const orderExists = hasOpenOrder(event.attempts);
  const pendingDeadline = pendingPaymentAttempts(event.attempts)
    .filter((attempt) => attempt.paymentDeadline)
    .sort((a, b) => a.paymentDeadline!.localeCompare(b.paymentDeadline!))[0]?.paymentDeadline;
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const platformGuidance = guide.find((item) => item.id === event.platform);
  const decision = chooseTier(
    event.tiers,
    event.tiers.map((_, i) => availability[i] ?? 'unknown'),
    event.quantity,
    null,
  );
  const eventChannel = effectivePurchaseChannel(event);
  const tierSignature = JSON.stringify(event.tiers);
  useEffect(() => setAvailability(event.tiers.map(() => 'unknown')), [event.id, tierSignature]);
  useEffect(
    () => setFollowLocal(formatLocalInstant(event.followUntil, event.timeZone)),
    [event.id, event.followUntil, event.timeZone],
  );
  useEffect(() => setResultOpportunity(''), [event.id]);
  function updateSale(item: SaleOpportunity, status: SaleOpportunity['status']) {
    void onMutate((current) => ({
      ...current,
      opportunities: current.opportunities.map((o) => (o.id === item.id ? { ...o, status } : o)),
    }));
  }
  async function addResult(e: FormEvent) {
    e.preventDefault();
    if (resultSubmitting.current) return;
    resultSubmitting.current = true;
    setResultBusy(true);
    try {
      setResultError('');
      let paymentDeadline: string | null = null;
      try {
        if (resultStatus === 'pending_payment' && resultDeadlineLocal)
          paymentDeadline = parseLocalInstant(resultDeadlineLocal, localZone);
      } catch {
        setResultError('支付截止时间无效，请按本机当地时间重新填写');
        return;
      }
      const resultId = crypto.randomUUID();
      const recordedAt = new Date().toISOString();
      const saved = await onMutate((current) => ({
        ...current,
        attempts: [
          ...current.attempts,
          {
            id: resultId,
            at: recordedAt,
            opportunityId: resultOpportunity || null,
            status: resultStatus,
            paymentDeadline,
            tier: resultTier.trim(),
            total: resultTotal === '' ? null : Number(resultTotal),
            evidence: evidence.trim(),
            note: resultNote.trim(),
          },
        ],
      }));
      if (!saved) return;
      setResultTier('');
      setResultTotal('');
      setResultDeadlineLocal('');
      setEvidence('');
      setResultNote('');
    } finally {
      resultSubmitting.current = false;
      setResultBusy(false);
    }
  }
  return (
    <>
      <button className="back-link" onClick={onBack}>
        ← 返回任务列表
      </button>
      <div className="detail-heading">
        <div>
          <span className="eyebrow">{platformLabels[event.platform]} · 演出场次</span>
          <h1>{event.title}</h1>
          <p>
            {event.venue || '场馆未填'} <span>·</span> {sessionSummary(event)} <span>·</span>{' '}
            {event.timeZone}
          </p>
        </div>
        <div className="button-row">
          <button className="button ghost" onClick={onEdit}>
            <Settings2 size={17} /> 编辑规则
          </button>
          {eventChannel === 'app_required' &&
            event.platform === 'damai' &&
            window.ticket.environment !== 'web' && (
              <button
                className="button primary"
                onClick={() => void onLaunchDamai().then(setPhoneStatus)}
              >
                <Smartphone size={17} /> 在手机打开大麦 App
              </button>
            )}
          {eventChannel !== 'app_required' && (
            <button
              className="button primary"
              onClick={() => void onOpenInside(event.id)}
              disabled={!event.eventUrl}
            >
              <ExternalLink size={17} />{' '}
              {window.ticket.environment === 'web' ? '打开官方网页' : '内置官方网页'}
            </button>
          )}
          {eventChannel === 'app_required' && event.eventUrl && (
            <button className="button ghost" onClick={() => void onOpenInside(event.id)}>
              查看官网项目页
            </button>
          )}
          <button
            className="button ghost"
            onClick={() => void onOpen(event)}
            disabled={!event.eventUrl}
          >
            系统浏览器
          </button>
        </div>
      </div>
      {event.sessions?.length ? (
        <div className="saved-sessions" role="list" aria-label="已选择的演出场次">
          {event.sessions.map((session) => (
            <span role="listitem" key={session.local}>
              {session.label}
            </span>
          ))}
        </div>
      ) : null}
      {eventChannel === 'app_required' && (
        <p className="channel-notice" role="status">
          {purchaseChannelLabels[eventChannel]}。网页仅用于核对公告；活动需在原平台 App 内定位。
          {event.platform !== 'damai' ? '该平台尚无实测的手机启动入口，请在手机手动打开。' : ''}
        </p>
      )}
      {(phoneStatus || phoneLaunchMessage) && (
        <p className="channel-notice" role="status">
          {phoneStatus || phoneLaunchMessage}
        </p>
      )}
      <div className="metric-bar">
        <div>
          <span>固定人数</span>
          <strong>{event.quantity} 人</strong>
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
      <div className="task-journey" role="tablist" aria-label="购票流程">
        {(
          [
            ['sales', '01', '官方机会', `${event.opportunities.length} 条已记录`],
            [
              'ready',
              '02',
              '开售准备',
              `${Object.values(event.checklist).filter(Boolean).length}/8 已核对`,
            ],
            ['tickets', '03', '票档判断', `${event.tiers.length} 个可接受票档`],
            ['results', '04', '订单结果', latest ? resultLabels[latest.status] : '等待人工记录'],
          ] as const
        ).map(([key, num, title, hint]) => (
          <button
            key={key}
            role="tab"
            aria-selected={detailTab === key}
            className={detailTab === key ? 'selected' : ''}
            onClick={() => setDetailTab(key)}
          >
            <span>{num}</span>
            <strong>{title}</strong>
            <small>{hint}</small>
          </button>
        ))}
      </div>
      <div className={`detail-grid ${detailTab === 'results' ? 'results-layout' : ''}`}>
        <div className="detail-column">
          {detailTab === 'sales' && (
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
                          {item.timeZone} · 来源核实 {item.verifiedAt} ·{' '}
                          {purchaseChannelLabels[effectivePurchaseChannel(event, item)]}
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
                          {effectivePurchaseChannel(event, item) === 'app_required' &&
                            event.platform === 'damai' &&
                            window.ticket.environment !== 'web' && (
                              <button
                                className="text-button"
                                onClick={() => void onLaunchDamai().then(setPhoneStatus)}
                              >
                                <Smartphone size={14} /> 打开大麦 App
                              </button>
                            )}
                          {item.url && (
                            <>
                              <button
                                className="text-button"
                                onClick={() => void onOpenInside(event.id, item.id)}
                              >
                                <ExternalLink size={14} />{' '}
                                {effectivePurchaseChannel(event, item) === 'app_required'
                                  ? '查看官网说明'
                                  : '内置网页'}
                              </button>
                              <button
                                className="text-button"
                                onClick={() => void onOpen(event, item.url)}
                              >
                                {effectivePurchaseChannel(event, item) === 'app_required'
                                  ? '浏览器核对规则'
                                  : '系统浏览器'}
                              </button>
                            </>
                          )}
                          <button
                            className="text-button"
                            onClick={() => void onReference(event.id, item.id)}
                          >
                            核对公告
                          </button>
                          <button className="text-button" onClick={() => onEditSale(item)}>
                            编辑
                          </button>
                          <button
                            className="text-button danger"
                            onClick={() => {
                              if (
                                window.confirm(
                                  '删除这条销售机会？相关结果会保留，但不再关联此机会。',
                                )
                              )
                                void onMutate((current) =>
                                  removeSaleKeepingResults(current, item.id),
                                );
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
          )}
          {detailTab === 'ready' && (
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
                        void onMutate((current) => ({
                          ...current,
                          checklist: { ...current.checklist, [key]: e.target.checked },
                        }))
                      }
                    />
                    <span className="custom-check">
                      <Check size={14} />
                    </span>
                    <span>{checklistLabels[key]}</span>
                  </label>
                ))}
              </div>
              <p className="help-note">
                只记录已核实项。证件号、账号密码和支付凭据不要输入本工具。
              </p>
            </section>
          )}
          {detailTab === 'tickets' && (
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
                    <span className="tier-letter">{i + 1}</span>
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
                            ? '当前票档需核对实际价格'
                            : '暂无可买票档'}
                </strong>
                <p>{orderExists ? '优先完成已有订单，不继续提交新单。' : decision.note}</p>
              </div>
            </section>
          )}
        </div>
        <div className="detail-column">
          {detailTab !== 'results' && (
            <section className="panel">
              <div className="section-title">
                <div>
                  <span className="eyebrow">SOURCE OF TRUTH</span>
                  <h2>本场规则</h2>
                </div>
                <button className="text-button" onClick={() => void onReference(event.id)}>
                  <Link2 size={16} /> 核对来源
                </button>
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
                  {platformGuidance?.text || '请以本场官方公告核对资格、入口与购票流程。'}
                  <br />
                  未接入实时库存、自动排队或自动提交。
                </p>
              </div>
            </section>
          )}
          {detailTab === 'results' && (
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
              {pendingDeadline && (
                <div className="payment-deadline" role="status">
                  <strong>
                    {Date.parse(pendingDeadline) > clock
                      ? '待支付订单即将截止'
                      : '记录的支付截止时间已过'}
                  </strong>
                  <span>
                    本机时间 {timeText(pendingDeadline, localZone)} ·{' '}
                    {Date.parse(pendingDeadline) > clock
                      ? `约剩 ${Math.ceil((Date.parse(pendingDeadline) - clock) / 60_000)} 分钟`
                      : '请在官方订单页核实当前状态'}
                  </span>
                  <small>以官方页面实时倒计时为准；本工具不会自动付款。</small>
                </div>
              )}
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
                <label className="result-evidence">
                  确认依据
                  <input
                    required={activeOrder.has(resultStatus)}
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    placeholder="例如：官方订单号后四位（勿填完整证件）"
                  />
                </label>
                {resultStatus === 'pending_payment' && (
                  <label className="result-deadline">
                    支付截止（本机当地时间，选填）
                    <input
                      type="datetime-local"
                      value={resultDeadlineLocal}
                      onChange={(e) => setResultDeadlineLocal(e.target.value)}
                    />
                    <small>只填写官方订单页确认的截止时间；桌面版运行期间会在临近时提醒。</small>
                  </label>
                )}
                <label className="result-note">
                  备注
                  <textarea
                    rows={2}
                    value={resultNote}
                    onChange={(e) => setResultNote(e.target.value)}
                    placeholder="失败原因、截止时间或需要人工处理的事项"
                  />
                </label>
                <button className="button secondary" type="submit" disabled={resultBusy}>
                  <Plus size={16} /> {resultBusy ? '正在保存…' : '记录当前结果'}
                </button>
                {resultError && (
                  <p className="form-error" role="alert">
                    {resultError}
                  </p>
                )}
              </form>
              {event.attempts.length ? (
                <div className="journal">
                  {[...event.attempts].reverse().map((attempt) => (
                    <div className="journal-row" key={attempt.id}>
                      <div className="journal-dot" />
                      <div>
                        <div>
                          <StatusPill status={attempt.status} />
                          <small>
                            {timeText(attempt.at, event.timeZone)} {event.timeZone}
                          </small>
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
          )}
          {detailTab === 'sales' && (
            <section className="panel subtle-panel">
              <div className="section-title">
                <div>
                  <span className="eyebrow">FOLLOW UP</span>
                  <h2>后续机会</h2>
                </div>
              </div>
              <p>
                默认跟进到末场演出开始。没有官方补票或候补来源时，状态保持“暂无已确认后续机会”，不预测整点回流。
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    const at = parseLocalInstant(followLocal, event.timeZone);
                    if (at > lastPerformanceAt(event))
                      throw new Error('跟进截止不能晚于末场演出开始');
                    void onMutate((current) => ({ ...current, followUntil: at }));
                  } catch {
                    window.alert('请输入有效的截止时间，且不能晚于末场演出开始。');
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
          )}
        </div>
      </div>
    </>
  );
}
