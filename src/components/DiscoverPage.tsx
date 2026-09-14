import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Globe2,
  Link2,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import type { DiscoveredEvent, DiscoveryViewState } from '../../shared/discovery';
import type { PlatformId } from '../../shared/model';
import { resolveSearch, searchSources } from '../../shared/search-sources';
import './discover.css';

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
    : fallback;
}

export function DiscoverPage({
  web,
  suspended,
  onDiscovered,
}: {
  web: boolean;
  suspended: boolean;
  onDiscovered: (event: DiscoveredEvent) => void;
}) {
  const [platform, setPlatform] = useState<PlatformId>('damai');
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [deviceMessage, setDeviceMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [state, setState] = useState<DiscoveryViewState | null>(null);
  const [preview, setPreview] = useState<DiscoveredEvent | null>(null);
  const browserPane = useRef<HTMLDivElement>(null);
  const lastUrl = useRef('');
  const source = searchSources.find((item) => item.platform === platform)!;

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
  }, [web, state?.platform, suspended]);
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
      if (!web) {
        setMessage(
          source.mode === 'keyword'
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
      await window.ticket.openOfficial('damai', 'https://passport.damai.cn/accountinfo/myinfo');
    } catch (error) {
      setMessage(messageOf(error, '无法打开大麦账户入口'));
    }
  }
  async function openPhone() {
    try {
      setDeviceMessage(await window.ticket.launchDamai());
    } catch (error) {
      setDeviceMessage(messageOf(error, '无法打开手机大麦'));
    }
  }

  return (
    <div className="discover-page">
      <section className="discover-hero">
        <div className="discover-hero-copy">
          <span className="eyebrow">FIND YOUR EVENT / 多平台发现</span>
          <h1>搜索你想看的演出</h1>
          <p>选一个官方平台，输入关键词或粘贴该平台活动链接。桌面版在下方同一页面显示官网。</p>
          <div className="discover-sources" role="group" aria-label="选择搜索平台">
            {searchSources.map((item) => (
              <button
                key={item.platform}
                type="button"
                className={platform === item.platform ? 'selected' : ''}
                aria-pressed={platform === item.platform}
                onClick={() => {
                  setPlatform(item.platform);
                  setMessage('');
                  setPreview(null);
                }}
              >
                <strong>{item.label}</strong>
                <small>{item.region}</small>
              </button>
            ))}
          </div>
          <form className="discover-search" onSubmit={(event) => void search(event)}>
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="演出关键词或官方活动链接"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="歌手、活动名，或粘贴所选平台的官方链接"
              autoFocus
            />
            <button type="submit" disabled={busy}>
              {busy
                ? '打开中…'
                : /^https?:/i.test(input.trim())
                  ? '打开活动'
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
              <span title={state.url}>
                {state.hostname || '加载中'}
                {state.loading ? ' · 加载中' : ''}
              </span>
              <button
                title="在系统浏览器打开当前页"
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
            当前页面已离开所选平台官网，请先核对地址与登录要求。
          </p>
        )}
        {state?.error && (
          <p className="discover-domain-warning" role="alert">
            {state.error}
          </p>
        )}
        {preview && (
          <div className="discover-result" role="region" aria-label="识别结果">
            <div>
              <strong>{preview.title}</strong>
              <small>
                {preview.dateHint || '日期待核对'} · {preview.venue || '场馆待核对'}
              </small>
            </div>
            <button onClick={() => onDiscovered(preview)}>
              <Check size={16} /> 填入购票任务
            </button>
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
              大麦账号页 <ExternalLink size={15} />
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
          {platform === 'damai' && (
            <button className="text-button" onClick={() => void openPhone()} disabled={web}>
              尝试打开手机大麦 <Smartphone size={15} />
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
