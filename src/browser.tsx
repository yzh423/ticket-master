import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe2,
  LockKeyhole,
  ShieldAlert,
  Ticket,
  X,
} from 'lucide-react';
import type { BrowserState } from '../shared/browser';
import { platformLabels } from '../shared/model';
import './browser.css';

function BrowserShell() {
  const [state, setState] = useState<BrowserState | null>(null);
  const [bridgeError, setBridgeError] = useState('');
  useEffect(() => {
    void window.officialBrowser
      .state()
      .then(setState)
      .catch((error) => setBridgeError(String(error)));
    return window.officialBrowser.onChanged(setState);
  }, []);
  const target = state?.target;
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
          <LockKeyhole size={15} />
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
        <span className="micro-label">LIVE SESSION / 官方页面</span>
        <h1>{target?.title || '正在载入…'}</h1>
        <p className="browser-context">{target?.opportunity || '本场官方购票入口'} · 人工操作</p>
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
                {tier.unitPrice === null ? '单价待核对' : `${tier.unitPrice.toLocaleString()} / 张`}
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
