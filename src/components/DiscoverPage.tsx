import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Globe2,
  Link2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import type { DiscoveredEvent, DiscoveryViewState } from '../../shared/discovery';
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
const featuredPlatforms = new Set<PlatformId>([
  'damai',
  'maoyan',
  'showstart',
  'hkticketing',
  'urbtix',
  'ticketmaster',
  'axs',
  'klook',
]);

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
}: {
  web: boolean;
  suspended: boolean;
  onDiscovered: (event: DiscoveredEvent) => void;
  activeTask?: EventRecord | null;
  activeOpportunity?: SaleOpportunity | null;
  onReturnToTask?: () => void;
  onClearTask?: () => void;
}) {
  const [platform, setPlatform] = useState<PlatformId>('damai');
  const [group, setGroup] = useState<'all' | SearchGroup>('all');
  const [showAll, setShowAll] = useState(false);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [deviceMessage, setDeviceMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [state, setState] = useState<DiscoveryViewState | null>(null);
  const [preview, setPreview] = useState<DiscoveredEvent | null>(null);
  const browserPane = useRef<HTMLDivElement>(null);
  const lastUrl = useRef('');
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
  async function openAccount() {
    try {
      if (activeTask) onClearTask?.();
      setPlatform('damai');
      await window.ticket.discover('damai', 'https://passport.damai.cn/accountinfo/myinfo');
      browserPane.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      setMessage(messageOf(error, '无法打开大麦账户入口'));
    }
  }
  async function openPhone() {
    try {
      if (purchaseChannel === 'app_required') {
        setDeviceMessage(
          platform === 'damai'
            ? await window.ticket.launchDamai()
            : `${source.label} 本次需官方 App；当前没有经实测的 App 启动入口，请在手机手动打开。`,
        );
        return;
      }
      const target = state?.platform === platform && state.trustedDomain ? state.url : source.home;
      setDeviceMessage(
        await window.ticket.openOfficialOnAndroid(platform, target, purchaseChannel),
      );
    } catch (error) {
      setDeviceMessage(messageOf(error, '无法向手机发送官方链接'));
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
              固定 {activeTask.quantity} 人 · 总预算 {activeTask.budget} {activeTask.currency} ·
              票档 {activeTask.tiers.map((tier) => tier.label).join(' → ')}
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
          <h1>{activeTask ? '核对当前官方页面' : '搜索你想看的演出'}</h1>
          <p>
            {activeTask
              ? '保持当前官方会话，按任务条件核对场次、票档与实际总价。'
              : '选择渠道，搜索活动。官网在工作区以标签页打开；登录与购票仍由官网完成。'}
          </p>
          {!activeTask && (
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
          {!activeTask && (
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
                  <strong>{showAll ? '收起平台' : `更多平台 · ${searchSources.length}`}</strong>
                  <small>按类别筛选更快</small>
                </button>
              )}
            </div>
          )}
          <form className="discover-search" onSubmit={(event) => void search(event)}>
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="演出关键词或官方活动链接"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                source.mode === 'keyword'
                  ? '歌手、活动名，或粘贴官方链接'
                  : '粘贴官方链接；也可留空打开官网'
              }
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
                      ? '搜索演出'
                      : '打开官网'}{' '}
              <ArrowRight size={16} />
            </button>
          </form>
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
                  void window.ticket.discoveryExternal().catch((error) => setMessage(String(error)))
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
              <button aria-label="关闭站内网页" onClick={() => void window.ticket.discoveryClose()}>
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
                {preview.ticketOptions?.length ? '选择场次与票档' : '核对候选信息'}
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

      <div className="discover-section-heading">
        <div>
          <span className="eyebrow">BE READY</span>
          <h2>开售前一次准备好</h2>
        </div>
        <p>账号和实名资料留在官方平台，不在候票台保存密码或证件号码。</p>
      </div>
      <div className="discover-prep-grid">
        <article>
          <div className="discover-prep-icon">
            <Link2 size={19} />
          </div>
          <span className="discover-prep-step">ACCOUNT</span>
          <h3>登录正确账号</h3>
          <p>
            在实际购票的平台官网或 App 登录。系统浏览器、候票台内置网页和手机 App
            的登录会话并不共享。
          </p>
          {platform === 'damai' && (
            <button className="text-button" onClick={() => void openAccount()}>
              在站内打开大麦账号页 <ArrowRight size={15} />
            </button>
          )}
        </article>
        <article>
          <div className="discover-prep-icon">
            <Users size={19} />
          </div>
          <span className="discover-prep-step">ATTENDEES</span>
          <h3>核对实名观演人</h3>
          <p>在所选平台按具体活动规则登记或选择观演人，并核对人数、证件及购票资格。</p>
          {purchaseChannel === 'app_required' && platform !== 'damai' ? (
            <small>
              {source.label} 本次需原生 App；尚未核实安全的手机启动入口，请在手机手动打开。
            </small>
          ) : (
            <button className="text-button" onClick={() => void openPhone()} disabled={web}>
              {purchaseChannel === 'app_required'
                ? '在 Android 打开大麦 App'
                : '发送官方网页链接到 Android'}{' '}
              <Smartphone size={15} />
            </button>
          )}
          {deviceMessage && <small role="status">{deviceMessage}</small>}
        </article>
      </div>
      <p className="discover-footnote">
        仅从官方活动页读取公开资料。部分平台不提供可识别的活动标记；这时仍可在官网查看详情，再手动建立任务。固定场次、所在地时区、票档、人数与预算始终需要核对。
      </p>
    </div>
  );
}
