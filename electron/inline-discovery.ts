import { BrowserWindow, session, shell, WebContentsView } from 'electron';
import type { PlatformId } from '../shared/model';
import {
  parseDamaiPublicDetail,
  parseStructuredPublicEvent,
  type DamaiPublicFields,
  type DiscoveredEvent,
  type DiscoveryViewState,
  type StructuredPublicFields,
} from '../shared/discovery';
import { resolveSearch } from '../shared/search-sources';
import { officialUrl, referenceUrl } from '../shared/rules';

export type DiscoveryBounds = { x: number; y: number; width: number; height: number };

export class InlineDiscovery {
  private view: WebContentsView | null = null;
  private readonly views = new Map<PlatformId, WebContentsView>();
  private platform: PlatformId | null = null;
  private targetUrl = '';
  private error = '';
  private failedUrl = '';
  private bounds: DiscoveryBounds | null = null;

  constructor(private readonly window: BrowserWindow) {}

  isOpenFor(platform: PlatformId): boolean {
    return this.views.has(platform);
  }

  close(): void {
    if (this.view) {
      this.window.contentView.removeChildView(this.view);
      if (!this.view.webContents.isDestroyed()) this.view.webContents.close();
      if (this.platform) this.views.delete(this.platform);
    }
    this.view = null;
    this.platform = null;
    this.targetUrl = '';
    this.error = '';
    this.failedUrl = '';
    const previous = [...this.views.keys()].at(-1);
    if (previous) this.switch(previous);
    else this.publish();
  }

  switch(platform: PlatformId): void {
    const next = this.views.get(platform);
    if (!next) throw new Error('该平台尚未打开网页标签');
    this.view?.setVisible(false);
    this.view = next;
    this.platform = platform;
    this.targetUrl = next.webContents.getURL();
    this.error = '';
    this.failedUrl = '';
    this.setBounds(this.bounds);
    this.publish();
  }

  state(): DiscoveryViewState | null {
    if (!this.view || !this.platform) return null;
    const contents = this.view.webContents;
    const url = (this.error && this.failedUrl) || contents.getURL() || this.targetUrl;
    let hostname = '';
    try {
      hostname = new URL(url).hostname;
    } catch {
      /* page not loaded */
    }
    return {
      platform: this.platform,
      url,
      hostname,
      trustedDomain: officialUrl(this.platform, url),
      loading: contents.isLoading(),
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
      error: this.error,
      tabs: [...this.views].map(([platform, view]) => ({
        platform,
        url: view.webContents.getURL(),
      })),
    };
  }

  private publish(): void {
    if (!this.window.isDestroyed()) this.window.webContents.send('discovery:changed', this.state());
  }

  open(platform: PlatformId, input: string): void {
    const { url } = resolveSearch(platform, input);
    if (this.platform !== platform || !this.view) {
      if (this.views.has(platform)) this.switch(platform);
      else this.createView(platform);
    }
    if (!this.view) throw new Error('无法建立内置搜索区域');
    if (this.targetUrl === url && this.view.webContents.getURL() === url) {
      this.publish();
      return;
    }
    this.targetUrl = url;
    this.error = '';
    this.failedUrl = '';
    this.publish();
    const view = this.view;
    void view.webContents.loadURL(url).catch((error: unknown) => {
      if (this.view !== view || this.targetUrl !== url || String(error).includes('ERR_ABORTED'))
        return;
      this.error = error instanceof Error ? error.message : '官网页面无法加载';
      this.failedUrl = url;
      this.publish();
    });
  }

  private createView(platform: PlatformId): void {
    this.view?.setVisible(false);
    this.platform = platform;
    this.targetUrl = '';
    this.error = '';
    this.failedUrl = '';
    const browserSession = session.fromPartition(`persist:ticket-${platform}`);
    browserSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    browserSession.setPermissionCheckHandler(() => false);
    const view = new WebContentsView({
      webPreferences: {
        session: browserSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    this.view = view;
    this.views.set(platform, view);
    view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
    view.setVisible(false);
    this.window.contentView.addChildView(view);
    const contents = view.webContents;
    contents.setWindowOpenHandler(({ url, disposition, postBody }) => {
      if (
        !postBody &&
        referenceUrl(url) &&
        (disposition === 'default' || disposition === 'foreground-tab')
      ) {
        if (this.view === view) this.targetUrl = url;
        void contents.loadURL(url).catch((error: unknown) => {
          if (this.view !== view || String(error).includes('ERR_ABORTED')) return;
          this.error = error instanceof Error ? error.message : '登录页无法加载';
          this.failedUrl = url;
          this.publish();
        });
      } else {
        if (this.view === view) {
          this.error = postBody
            ? '网站的登录或支付弹窗需要提交表单，当前标签无法安全延续该请求；请使用系统浏览器或官方 App。'
            : '网站请求打开新窗口或非 HTTPS 页面。可在系统浏览器继续该平台流程。';
          this.publish();
        }
      }
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      if (!url.startsWith('https://')) {
        event.preventDefault();
        this.error = '已阻止非 HTTPS 页面';
        this.publish();
      }
    });
    contents.on('will-redirect', (event, url) => {
      if (!url.startsWith('https://')) event.preventDefault();
    });
    contents.on('did-start-loading', () => {
      if (this.view !== view) return;
      this.error = '';
      this.failedUrl = '';
      this.publish();
    });
    contents.on('did-stop-loading', () => this.publish());
    contents.on('did-navigate', () => this.publish());
    contents.on('did-navigate-in-page', () => this.publish());
    contents.on('did-fail-load', (_event, code, description, failedUrl, mainFrame) => {
      if (!mainFrame || code === -3) return;
      if (this.view !== view) return;
      this.error = `页面加载失败（${code}）：${description}。可在系统浏览器或官方 App 继续。`;
      this.failedUrl = failedUrl;
      this.publish();
    });
    this.setBounds(this.bounds);
    this.publish();
  }

  setBounds(bounds: DiscoveryBounds | null): void {
    this.bounds = bounds;
    if (!this.view) return;
    if (!bounds) {
      this.view.setVisible(false);
      return;
    }
    const { width: maxWidth, height: maxHeight } = this.window.getContentBounds();
    const { x, y, width, height } = bounds;
    if (![x, y, width, height].every(Number.isFinite)) throw new Error('搜索区域尺寸无效');
    const left = Math.max(0, Math.round(x));
    const top = Math.max(0, Math.round(y));
    const right = Math.min(maxWidth, Math.round(x + width));
    const bottom = Math.min(maxHeight, Math.round(y + height));
    if (right <= left || bottom <= top) {
      this.view.setVisible(false);
      return;
    }
    this.view.setBounds({ x: left, y: top, width: right - left, height: bottom - top });
    this.view.setVisible(true);
  }

  back(): void {
    if (this.view?.webContents.navigationHistory.canGoBack())
      this.view.webContents.navigationHistory.goBack();
  }

  forward(): void {
    if (this.view?.webContents.navigationHistory.canGoForward())
      this.view.webContents.navigationHistory.goForward();
  }

  async external(): Promise<void> {
    const state = this.state();
    if (!state || !referenceUrl(state.url)) throw new Error('当前网页不是安全的 HTTPS 地址');
    await shell.openExternal(state.url);
  }

  async inspect(): Promise<DiscoveredEvent> {
    if (!this.view || !this.platform) throw new Error('请先打开平台搜索');
    const current = this.view.webContents.getURL();
    if (!officialUrl(this.platform, current)) throw new Error('请先返回所选平台的官方活动页');
    if (this.platform === 'damai') {
      if (!/^https:\/\/detail\.damai\.cn\/item\.htm\?/.test(current))
        throw new Error('请先打开大麦活动详情页');
      const raw = (await this.view.webContents.executeJavaScript(`(() => {
        const text = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
        const notice = text('.notice0');
        return { pageUrl: location.href, title: text('.hd .title span'),
          dateText: text('.hd .time'), venueText: text('.hd .addr'),
          appOnly: document.body?.innerText?.includes('该渠道不支持购买') || false,
          limitText: notice.match(/每笔订单最多购买[^。]{0,120}。/)?.[0] || '' };
      })()`)) as Partial<DamaiPublicFields> & { pageUrl?: string };
      return parseDamaiPublicDetail(String(raw?.pageUrl ?? ''), {
        title: String(raw?.title ?? ''),
        dateText: String(raw?.dateText ?? ''),
        venueText: String(raw?.venueText ?? ''),
        appOnly: raw?.appOnly === true,
        limitText: String(raw?.limitText ?? ''),
      });
    }
    const raw = (await this.view.webContents.executeJavaScript(`(() => {
      const nodes = [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 40);
      for (const script of nodes) {
        try {
          const queue = [JSON.parse((script.textContent || '').slice(0, 100000))];
          for (let i = 0; i < queue.length && i < 100; i++) {
            const value = queue[i];
            if (Array.isArray(value)) { queue.push(...value.slice(0, 40)); continue; }
            if (!value || typeof value !== 'object') continue;
            const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
            if (types.some((type) => typeof type === 'string' && /(^|\\/)\\w*Event$/.test(type))) {
              const place = value.location;
              return { pageUrl: location.href, title: value.name || '',
                dateText: value.startDate || '',
                venueText: typeof place === 'object' && place ? place.name || '' : '' };
            }
            if (value['@graph']) queue.push(value['@graph']);
          }
        } catch { /* malformed public markup */ }
      }
      return { pageUrl: location.href, title: '', dateText: '', venueText: '' };
    })()`)) as Partial<StructuredPublicFields> & { pageUrl?: string };
    return parseStructuredPublicEvent(this.platform, String(raw?.pageUrl ?? ''), {
      title: String(raw?.title ?? ''),
      dateText: String(raw?.dateText ?? ''),
      venueText: String(raw?.venueText ?? ''),
    });
  }
}
