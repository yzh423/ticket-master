import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Globe2,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  mayContainEventDetail,
  type DiscoveredEvent,
  type DiscoveryViewState,
} from '../../shared/discovery';
import {
  platformLabels,
  purchaseChannelLabels,
  type EventRecord,
  type PlatformId,
  type SaleOpportunity,
} from '../../shared/model';
import { effectivePurchaseChannel } from '../../shared/rules';
import { resolveSearch, searchSources, type SearchGroup } from '../../shared/search-sources';
import './discover.css';

const groups: { id: 'all' | SearchGroup; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'mainland', label: '内地演出' },
  { id: 'hongkong', label: '香港' },
  { id: 'international', label: '国际演出' },
  { id: 'attractions', label: '景点体验' },
  { id: 'resale', label: '转售市场' },
];
const featuredPlatforms = new Set<PlatformId>(['damai', 'maoyan', 'ticketmaster', 'klook']);

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
    : fallback;
}

export function DiscoverPage({
  web,
  suspended,
  onDiscovered,
  activeTask,
  activeOpportunity,
  onReturnToTask,
  onClearTask,
  setupPanel,
  setupOpen = false,
}: {
  web: boolean;
  suspended: boolean;
  onDiscovered: (event: DiscoveredEvent) => void;
  activeTask?: EventRecord | null;
  activeOpportunity?: SaleOpportunity | null;
  onReturnToTask?: () => void;
  onClearTask?: () => void;
  setupPanel?: ReactNode;
  setupOpen?: boolean;
}) {
  const [platform, setPlatform] = useState<PlatformId>('damai');
  const [group, setGroup] = useState<'all' | SearchGroup>('all');
  const [showAll, setShowAll] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(false);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [state, setState] = useState<DiscoveryViewState | null>(null);
  const [preview, setPreview] = useState<DiscoveredEvent | null>(null);
  const browserPane = useRef<HTMLDivElement>(null);
  const lastUrl = useRef('');
  const autoInspectedUrl = useRef('');
  const source = searchSources.find((item) => item.platform === platform) ?? {
    platform,
    label: platformLabels[platform],
    region: '指定官方链接',
    group: 'mainland' as const,
    mode: 'site' as const,
    home: state?.url ?? '',
  };
  const purchaseChannel =
    preview?.appOnly && state?.platform === platform
      ? 'app_required'
      : activeTask?.platform === platform
        ? effectivePurchaseChannel(activeTask, activeOpportunity ?? undefined)
        : 'unknown';

  useEffect(() => {
    if (activeTask) {
      setPlatform(activeTask.platform);
      setInput('');
    }
  }, [activeTask?.id, activeTask?.platform]);
  useEffect(() => {
    if (activeTask && state && state.platform !== activeTask.platform) onClearTask?.();
  }, [activeTask?.id, activeTask?.platform, state?.platform]);

  useEffect(() => {
    const unsubscribe = window.ticket.onDiscoveryChanged(setState);
    void window.ticket
      .discoveryState()
      .then(setState)
      .catch(() => {});
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (state?.url !== lastUrl.current) {
      lastUrl.current = state?.url ?? '';
      setPreview(null);
    }
  }, [state?.url]);
  useEffect(() => {
    if (web || !state || suspended) return;
    const pane = browserPane.current;
    if (!pane) return;
    const sync = () => {
      const rect = pane.getBoundingClientRect();
      void window.ticket
        .discoveryBounds({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
        .catch(() => {});
    };
    const observer = new ResizeObserver(sync);
    observer.observe(pane);
    if (pane.parentElement) observer.observe(pane.parentElement);
    observer.observe(document.body);
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    sync();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
      void window.ticket.discoveryBounds(null).catch(() => {});
    };
  }, [web, Boolean(state), suspended]);
  useEffect(() => {
    if (
      state?.platform === 'damai' &&
      !state.loading &&
      /^https:\/\/detail\.damai\.cn\/item\.htm\?/.test(state.url)
    )
      void inspect();
  }, [state?.url, state?.loading, state?.platform]);
  useEffect(() => {
    if (
      web ||
      !state?.url ||
      state.platform === 'damai' ||
      !state.trustedDomain ||
      !mayContainEventDetail(state.url) ||
      state.loading ||
      state.error ||
      activeTask ||
      autoInspectedUrl.current === state.url
    )
      return;
    const url = state.url;
    autoInspectedUrl.current = url;
    void window.ticket
      .discoveryInspect()
      .then((found) => {
        if (lastUrl.current === url) setPreview(found);
      })
      .catch(() => {
        // Ordinary home and search pages may not contain an Event marker.
      });
  }, [
    web,
    state?.url,
    state?.platform,
    state?.trustedDomain,
    state?.loading,
    state?.error,
    activeTask?.id,
  ]);

  async function inspect() {
    setInspecting(true);
    setMessage('');
    try {
      setPreview(await window.ticket.discoveryInspect());
    } catch (error) {
      setPreview(null);
      setMessage(messageOf(error, '无法读取当前活动'));
    } finally {
      setInspecting(false);
    }
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    setPreview(null);
    setBusy(true);
    try {
      resolveSearch(platform, input);
      await window.ticket.discover(platform, input);
      if (activeTask) onClearTask?.();
      if (!web) {
        setMessage(
          /^https?:/i.test(input.trim())
            ? `已打开 ${source.label} 官方活动页。请核对场次与购票规则。`
            : !input.trim()
              ? `已打开 ${source.label} 官网。`
              : source.mode === 'keyword'
                ? `已在下方打开 ${source.label} 搜索。选择具体活动后读取公开信息。`
                : `已在下方打开 ${source.label} 官网。请在站内搜索「${input.trim()}」并打开具体活动。`,
        );
        requestAnimationFrame(() =>
          browserPane.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        );
      }
    } catch (error) {
      setMessage(messageOf(error, '无法打开官方搜索'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="discover-page">
      {activeTask && (
        <section className="discover-task-context" aria-label="当前任务购票条件">
          <div>
            <span className="eyebrow">ACTIVE TASK / 当前任务</span>
            <strong>{activeTask.title}</strong>
            <small>
              固定 {activeTask.quantity} 人 · 票档{' '}
              {activeTask.tiers.map((tier) => tier.label).join(' → ')}
              {' · '}
              {purchaseChannelLabels[purchaseChannel]}
            </small>
          </div>
          <button className="button secondary" onClick={onReturnToTask}>
            返回任务
          </button>
        </section>
      )}
      <section className={`discover-hero${activeTask ? ' task-mode' : ''}`}>
        <div className="discover-hero-copy">
          <span className="eyebrow">
            {activeTask ? 'OFFICIAL EVENT / 官方活动' : 'FIND YOUR EVENT / 多平台发现'}
          </span>
          <h1>{activeTask ? '官方购票' : '找演出'}</h1>
          <p>
            {activeTask ? '保持当前官方会话，按已选条件继续。' : '搜索活动名，或粘贴官方活动链接。'}
          </p>
          <form className="discover-search" onSubmit={(event) => void search(event)}>
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="演出关键词或官方活动链接"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={source.mode === 'keyword' ? '歌手、活动名或官方链接' : '粘贴官方链接'}
              autoFocus
            />
            <button type="submit" disabled={busy}>
              {busy
                ? '打开中…'
                : /^https?:/i.test(input.trim())
                  ? '打开活动'
                  : !input.trim()
                    ? '打开官网'
                    : source.mode === 'keyword'
                      ? '搜索'
                      : '打开官网'}{' '}
              <ArrowRight size={16} />
            </button>
          </form>
          {!activeTask && (
            <button
              type="button"
              className="discover-platform-trigger"
              aria-expanded={showPlatforms}
              onClick={() => setShowPlatforms((value) => !value)}
            >
              <Globe2 size={16} /> {source.label} <span>选择平台</span>
            </button>
          )}
          {!activeTask && showPlatforms && (
            <div className="discover-groups" role="group" aria-label="筛选平台类别">
              {groups.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={group === item.id}
                  className={group === item.id ? 'selected' : ''}
                  onClick={() => setGroup(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {!activeTask && showPlatforms && (
            <div className="discover-sources" role="group" aria-label="选择搜索平台">
              {searchSources
                .filter((item) =>
                  group === 'all'
                    ? showAll || featuredPlatforms.has(item.platform)
                    : item.group === group,
                )
                .map((item) => (
                  <button
                    key={item.platform}
                    type="button"
                    className={platform === item.platform ? 'selected' : ''}
                    aria-pressed={platform === item.platform}
                    onClick={() => {
                      setPlatform(item.platform);
                      setShowPlatforms(false);
                      setMessage('');
                      setPreview(null);
                      if (state?.tabs.some((tab) => tab.platform === item.platform))
                        void window.ticket.discoverySwitch(item.platform).then(() =>
                          browserPane.current?.scrollIntoView({
                            behavior: 'auto',
                            block: 'center',
                          }),
                        );
                    }}
                  >
                    <strong>{item.label}</strong>
                    <small>
                      {item.region} · {item.mode === 'keyword' ? '直达搜索' : '官网入口'}
                    </small>
                  </button>
                ))}
              {group === 'all' && (
                <button
                  type="button"
                  className="discover-more"
                  aria-expanded={showAll}
                  onClick={() => setShowAll((value) => !value)}
                >
                  <strong>{showAll ? '收起平台' : `全部 ${searchSources.length} 个平台`}</strong>
                  <small>展开完整列表</small>
                </button>
              )}
            </div>
          )}
          {message && (
            <p className="discover-message" role="status">
              {message}
            </p>
          )}
          <div className="discover-trust">
            <ShieldCheck size={15} /> 官方域名校验 · 不自动刷新排队页 · 验证码由你在官网完成
          </div>
        </div>
      </section>

      <div className={`discover-browser-layout${setupOpen ? ' has-setup' : ''}`}>
        <section className="discover-workspace" aria-label="站内官方网页">
          {state && !web && (
            <div className="discover-tabstrip" role="tablist" aria-label="已打开的官方网页">
              {state.tabs.map((tab) => (
                <button
                  key={tab.platform}
                  type="button"
                  role="tab"
                  aria-selected={state.platform === tab.platform}
                  title={
                    tab.url || searchSources.find((item) => item.platform === tab.platform)?.label
                  }
                  onClick={() => {
                    setPlatform(tab.platform);
                    void window.ticket
                      .discoverySwitch(tab.platform)
                      .then(() =>
                        browserPane.current?.scrollIntoView({ behavior: 'auto', block: 'center' }),
                      );
                  }}
                >
                  <Globe2 size={14} />
                  {searchSources.find((item) => item.platform === tab.platform)?.label ??
                    platformLabels[tab.platform]}
                </button>
              ))}
            </div>
          )}
          <div className="discover-workspace-head">
            <div>
              <span className="eyebrow">OFFICIAL BROWSER</span>
              <h2>官方网页</h2>
            </div>
            {state && !web && (
              <div className="discover-toolbar">
                <button
                  aria-label="搜索网页后退"
                  disabled={!state.canGoBack}
                  onClick={() => void window.ticket.discoveryBack()}
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  aria-label="搜索网页前进"
                  disabled={!state.canGoForward}
                  onClick={() => void window.ticket.discoveryForward()}
                >
                  <ArrowRight size={16} />
                </button>
                <span className="discover-location" title={state.url}>
                  {state.trustedDomain ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}{' '}
                  {state.hostname || '加载中'}
                  {state.loading ? ' · 加载中' : ''}
                </span>
                <button
                  title="在系统浏览器继续当前页"
                  aria-label="在系统浏览器打开当前页"
                  onClick={() =>
                    void window.ticket
                      .discoveryExternal()
                      .catch((error) => setMessage(String(error)))
                  }
                >
                  <ExternalLink size={16} />
                </button>
                <button
                  className="discover-inspect"
                  disabled={inspecting}
                  onClick={() => void inspect()}
                >
                  {inspecting ? '读取中…' : '读取活动信息'}
                </button>
                <button
                  aria-label="关闭站内网页"
                  onClick={() => void window.ticket.discoveryClose()}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          {state && !state.trustedDomain && (
            <p className="discover-domain-warning" role="alert">
              当前是 {state.hostname}
              ，可能是平台登录或支付跳转。请核对网址；候票台不会从此页面读取活动信息。
            </p>
          )}
          {state?.error && (
            <p className="discover-domain-warning" role="alert">
              {state.error} 如官网限制内置浏览器，可使用工具栏的“在系统浏览器继续当前页”。
            </p>
          )}
          {preview && (
            <div className="discover-result" role="region" aria-label="识别结果">
              <div>
                <strong>{preview.title}</strong>
                <small>
                  {preview.dateHint || '日期待核对'} · {preview.venue || '场馆待核对'}
                </small>
                <small>
                  {preview.sessions?.length
                    ? `${preview.sessions.length} 个候选场次`
                    : '未识别到可选场次'}
                  {' · '}
                  {preview.ticketOptions?.length
                    ? `${preview.ticketOptions.length} 个明确标价票档`
                    : preview.priceRange
                      ? `仅有价格范围 ${preview.priceRange}`
                      : '未识别到逐档价格'}
                </small>
                {preview.appOnly && (
                  <small>本项目网页提示需在大麦 App 下单；下方手机操作会打开原生 App。</small>
                )}
              </div>
              {activeTask ? (
                <small>当前任务已建立，请在任务页核对并修改规则。</small>
              ) : (
                <button onClick={() => onDiscovered(preview)}>
                  <Check size={16} />{' '}
                  {preview.ticketOptions?.length ? '选择场次和票档' : '查看官方购票入口'}
                </button>
              )}
            </div>
          )}
          <div className="discover-browser-pane" ref={browserPane}>
            {(!state || web) && (
              <div className="discover-browser-empty">
                <Globe2 size={36} />
                <strong>
                  {web ? '网页版本使用当前标签页打开官网' : '选择平台并搜索，官网会在这里显示'}
                </strong>
                <span>活动页的可读信息会经过你确认后带入任务。</span>
              </div>
            )}
          </div>
          {web && (
            <p className="discover-footnote">
              普通浏览器不能把多数票务网站嵌入本站。搜索会在当前标签页进入官网；使用浏览器“返回”回到候票台。自动读取详情仅支持
              Windows 桌面版。
            </p>
          )}
        </section>
        {setupOpen && (
          <aside className="discover-setup-slot" aria-label="购票准备">
            {setupPanel}
          </aside>
        )}
      </div>
    </div>
  );
}
