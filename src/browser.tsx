import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Globe2,
  LockKeyhole,
  ShieldAlert,
  Search,
  Ticket,
  X,
} from 'lucide-react';
import type { BrowserState } from '../shared/browser';
import type { DiscoveredEvent } from '../shared/discovery';
import { platformLabels } from '../shared/model';
import './browser.css';

function BrowserShell() {
  const [state, setState] = useState<BrowserState | null>(null);
  const [bridgeError, setBridgeError] = useState('');
  const [preview, setPreview] = useState<DiscoveredEvent | null>(null);
  const [discoverError, setDiscoverError] = useState('');
  const [inspecting, setInspecting] = useState(false);
  useEffect(() => {
    void window.officialBrowser
      .state()
      .then(setState)
      .catch((error) => setBridgeError(String(error)));
    return window.officialBrowser.onChanged(setState);
  }, []);
  const target = state?.target;
  useEffect(() => {
    setPreview(null);
    setDiscoverError('');
  }, [state?.url]);

  async function inspect() {
    setInspecting(true);
    setDiscoverError('');
    try {
      setPreview(await window.officialBrowser.inspectCurrent());
    } catch (error) {
      setPreview(null);
      setDiscoverError(error instanceof Error ? error.message : '无法识别当前页面');
    } finally {
      setInspecting(false);
    }
  }

  useEffect(() => {
    if (
      state?.target.mode === 'discovery' &&
      !state.loading &&
      /^https:\/\/detail\.damai\.cn\/item\.htm\?/.test(state.url)
    )
      void inspect();
  }, [state?.url, state?.loading, state?.target.mode]);

  async function useCurrent() {
    setDiscoverError('');
    try {
      if (!preview) throw new Error('请先识别当前活动');
      await window.officialBrowser.useCurrent(preview.eventUrl);
    } catch (error) {
      setDiscoverError(error instanceof Error ? error.message : '无法填入任务');
    }
  }
  return (
    <div className="browser-shell">
      <header className="browser-topbar">
        <div className="browser-identity">
          <span className="browser-logo">
            <Ticket size={19} />
          </span>
          <div>
            <strong>官方网页工作区</strong>
            <small>
              {target ? `${platformLabels[target.platform]} · ${target.title}` : '正在连接本地任务'}
            </small>
          </div>
        </div>
        <div className="browser-location" title={state?.url}>
          {state?.trustedDomain ? <LockKeyhole size={15} /> : <ShieldAlert size={15} />}
          <span>{state?.hostname || '等待页面加载'}</span>
          {state?.loading && <i className="loading-dot" />}
        </div>
        <div className="browser-actions">
          <button
            aria-label="网页后退"
            disabled={!state?.canGoBack}
            onClick={() => void window.officialBrowser.back()}
          >
            <ArrowLeft size={17} />
          </button>
          <button
            aria-label="网页前进"
            disabled={!state?.canGoForward}
            onClick={() => void window.officialBrowser.forward()}
          >
            <ArrowRight size={17} />
          </button>
          <span className="browser-action-divider" />
          <button
            className="external-action"
            onClick={() => void window.officialBrowser.external()}
          >
            <ExternalLink size={16} /> 系统浏览器
          </button>
          <button aria-label="关闭网页工作区" onClick={() => void window.officialBrowser.close()}>
            <X size={18} />
          </button>
        </div>
      </header>
      <aside className="browser-sidecar">
        {target?.mode === 'discovery' ? (
          <>
            <span className="micro-label">DISCOVER / 官方搜索</span>
            <h1>在大麦找到活动</h1>
            <p className="browser-context">在右侧选择具体项目，再读取公开信息。</p>
            <div className="discovery-guide">
              <div>
                <b>1</b>
                <span>搜索并打开活动详情</span>
              </div>
              <div>
                <b>2</b>
                <span>识别标题、日期范围与场馆</span>
              </div>
              <div>
                <b>3</b>
                <span>回到候票台核对固定场次</span>
              </div>
            </div>
            <button
              className="discovery-inspect"
              onClick={() => void inspect()}
              disabled={inspecting}
            >
              <Search size={16} /> {inspecting ? '读取中…' : '识别当前活动'}
            </button>
            {preview && (
              <div className="discovery-preview" role="region" aria-label="识别结果">
                <span className="micro-label">已读取公开页面</span>
                <strong>{preview.title}</strong>
                <p>{preview.dateHint || '日期待在官方页面核对'}</p>
                <p>{preview.venue || '场馆待核对'}</p>
                {preview.appOnly && <em>本项目网页提示需到大麦 App 下单</em>}
                <button onClick={() => void useCurrent()}>
                  <Check size={15} /> 填入购票任务
                </button>
              </div>
            )}
            {discoverError && (
              <div className="browser-warning" role="alert">
                <p>{discoverError}</p>
              </div>
            )}
            <div className="browser-rule">
              <ShieldAlert size={18} />
              <p>
                搜索页可能要求验证码，请在官方页面自行完成。只读取活动详情页的公开字段，不读取登录信息。
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="micro-label">LIVE SESSION / 官方页面</span>
            <h1>{target?.title || '正在载入…'}</h1>
            <p className="browser-context">
              {target?.opportunity || '本场官方购票入口'} · 人工操作
            </p>
            <div className="browser-intent">
              <span>本次购票硬条件</span>
              <div>
                <strong>
                  {target?.quantity ?? '—'} <small>人</small>
                </strong>
                <strong>
                  {target ? `${target.budget.toLocaleString()} ${target.currency}` : '—'}{' '}
                  <small>总预算</small>
                </strong>
              </div>
            </div>
            <div className="browser-tier-heading">
              <span>接受的票档</span>
              <small>按优先顺序</small>
            </div>
            <div className="browser-tiers">
              {target?.tiers.map((tier, index) => (
                <div key={index}>
                  <b>{String.fromCharCode(65 + index)}</b>
                  <span>{tier.label}</span>
                  <small>
                    {tier.unitPrice === null
                      ? '单价待核对'
                      : `${tier.unitPrice.toLocaleString()} / 张`}
                  </small>
                </div>
              ))}
            </div>
            <div className="browser-rule">
              <ShieldAlert size={18} />
              <p>
                核对票档、人数和含费用的最终总价。网页显示可选不代表锁票成功；只有官方订单状态才能确认结果。
              </p>
            </div>
          </>
        )}
        {!state?.trustedDomain && state && (
          <div className="browser-warning">
            <strong>已离开已验证的平台域名</strong>
            <small>{state.url}</small>
            <p>可能是登录或支付跳转，请自行核对域名与页面信息。</p>
          </div>
        )}
        {(state?.error || bridgeError) && (
          <div className="browser-warning">
            <strong>页面提示</strong>
            <p>{state?.error || bridgeError}</p>
          </div>
        )}
        <div className="browser-bottom">
          <Globe2 size={16} />
          <span>
            这个窗口使用独立的持久登录会话。遇到 App 专属下单、弹窗或页面限制时，使用原生 App
            或系统浏览器；不要刷新等候室。
          </span>
        </div>
      </aside>
      <div className="browser-remote-placeholder" aria-hidden="true">
        <div className="browser-placeholder-mark">
          <Globe2 size={34} />
        </div>
        <span>官方网页会显示在此区域</span>
      </div>
    </div>
  );
}

createRoot(document.getElementById('browser-root')!).render(
  <React.StrictMode>
    <BrowserShell />
  </React.StrictMode>,
);
