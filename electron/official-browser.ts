import {
  BrowserWindow,
  ipcMain,
  session,
  shell,
  WebContentsView,
  type WebContents,
} from 'electron';
import { join } from 'node:path';
import type { BrowserState, BrowserTarget } from '../shared/browser';
import { officialUrl } from '../shared/rules';
import {
  damaiDiscoveryUrl,
  parseDamaiPublicDetail,
  type DamaiPublicFields,
  type DiscoveredEvent,
} from '../shared/discovery';

export class OfficialBrowserManager {
  private window: BrowserWindow | null = null;
  private view: WebContentsView | null = null;
  private target: BrowserTarget | null = null;
  private error = '';

  constructor() {
    ipcMain.handle('browser:state', (event) => this.forShell(event.sender, () => this.state()));
    ipcMain.handle('browser:back', (event) =>
      this.forShell(event.sender, () => {
        if (this.view?.webContents.navigationHistory.canGoBack())
          this.view.webContents.navigationHistory.goBack();
      }),
    );
    ipcMain.handle('browser:forward', (event) =>
      this.forShell(event.sender, () => {
        if (this.view?.webContents.navigationHistory.canGoForward())
          this.view.webContents.navigationHistory.goForward();
      }),
    );
    ipcMain.handle('browser:close', (event) =>
      this.forShell(event.sender, () => this.window?.close()),
    );
    ipcMain.handle('browser:external', (event) =>
      this.forShell(event.sender, async () => {
        if (this.target && officialUrl(this.target.platform, this.target.url))
          await shell.openExternal(this.target.url);
      }),
    );
  }

  private forShell<T>(sender: WebContents, work: () => T): T {
    if (!this.window || sender !== this.window.webContents)
      throw new Error('只有内置浏览器工具栏可以控制该会话');
    return work();
  }

  private state(): BrowserState {
    if (!this.target) throw new Error('官方网页尚未打开');
    const contents = this.view?.webContents;
    const loaded = contents?.getURL();
    const url = loaded && loaded !== 'about:blank' ? loaded : this.target.url;
    let hostname = '';
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = '尚未加载';
    }
    return {
      target: this.target,
      url,
      hostname,
      trustedDomain: officialUrl(this.target.platform, url),
      loading: contents?.isLoading() ?? false,
      canGoBack: contents?.navigationHistory.canGoBack() ?? false,
      canGoForward: contents?.navigationHistory.canGoForward() ?? false,
      error: this.error,
    };
  }

  private publish(): void {
    if (this.window && !this.window.isDestroyed())
      this.window.webContents.send('browser:changed', this.state());
  }

  private bounds(): void {
    if (!this.window || !this.view) return;
    const { width, height } = this.window.getContentBounds();
    this.view.setBounds({
      x: 300,
      y: 100,
      width: Math.max(1, width - 300),
      height: Math.max(1, height - 100),
    });
  }

  isOpenFor(platform: BrowserTarget['platform']): boolean {
    return Boolean(this.window && !this.window.isDestroyed() && this.target?.platform === platform);
  }

  openDiscovery(input: string): void {
    const url = damaiDiscoveryUrl(input);
    this.open({
      mode: 'discovery',
      title: '搜索大麦演出',
      platform: 'damai',
      url,
      query: input.trim(),
    });
  }

  inspectCurrent(sender: WebContents): Promise<DiscoveredEvent> {
    return this.forShell(sender, async () => {
      if (this.target?.mode !== 'discovery' || !this.view)
        throw new Error('请先从发现演出进入官方搜索');
      const contents = this.view.webContents;
      const url = contents.getURL();
      if (!/^https:\/\/detail\.damai\.cn\/item\.htm\?/.test(url))
        throw new Error('请先打开大麦活动详情页，再识别公开信息');
      const raw = (await contents.executeJavaScript(`(() => {
        const text = (selector) => document.querySelector(selector)?.textContent?.trim() || '';
        const notice = text('.notice0');
        return {
          pageUrl: location.href,
          title: text('.hd .title span'),
          dateText: text('.hd .time'),
          venueText: text('.hd .addr'),
          appOnly: document.body?.innerText?.includes('该渠道不支持购买') || false,
          limitText: notice.match(/每笔订单最多购买[^。]{0,120}。/)?.[0] || ''
        };
      })()`)) as Partial<DamaiPublicFields> & { pageUrl?: string };
      return parseDamaiPublicDetail(String(raw?.pageUrl ?? ''), {
        title: String(raw?.title ?? ''),
        dateText: String(raw?.dateText ?? ''),
        venueText: String(raw?.venueText ?? ''),
        appOnly: raw?.appOnly === true,
        limitText: String(raw?.limitText ?? ''),
      });
    });
  }

  open(target: BrowserTarget): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.target?.mode === 'discovery' && target.mode === 'discovery') {
        const changed = this.target.url !== target.url;
        this.target = target;
        this.error = '';
        if (changed && this.view)
          void this.view.webContents.loadURL(target.url).catch((error: unknown) => {
            if (this.target?.url !== target.url || String(error).includes('ERR_ABORTED')) return;
            this.error = error instanceof Error ? error.message : '大麦页面无法加载';
            this.publish();
          });
        this.publish();
        if (this.window.isMinimized()) this.window.restore();
        this.window.focus();
        return;
      }
      if (
        this.target?.mode !== target.mode ||
        this.target.url !== target.url ||
        (this.target.mode === 'event' &&
          target.mode === 'event' &&
          this.target.eventId !== target.eventId)
      )
        throw new Error(
          '另一个官方网页会话正在打开。请先在该窗口中完成操作或手动关闭，避免误刷新队列。',
        );
      this.target = target;
      this.publish();
      if (this.window.isMinimized()) this.window.restore();
      this.window.focus();
      return;
    }
    this.target = target;
    this.error = '';
    const browserSession = session.fromPartition(`persist:ticket-${target.platform}`);
    browserSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    browserSession.setPermissionCheckHandler(() => false);
    this.window = new BrowserWindow({
      width: 1370,
      height: 900,
      minWidth: 1000,
      minHeight: 660,
      backgroundColor: '#0b111b',
      title: `${target.title} · 官方网页工作区`,
      webPreferences: {
        preload: join(__dirname, 'browser-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window.setMenu(null);
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.webContents.on('will-navigate', (event) => event.preventDefault());
    this.view = new WebContentsView({
      webPreferences: {
        session: browserSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    const content = this.view.webContents;
    content.on('will-navigate', (event, navigationUrl) => {
      if (!navigationUrl.startsWith('https://')) {
        event.preventDefault();
        this.error =
          '该页面尝试打开非 HTTPS 地址，已阻止。可按原平台指引在系统浏览器或 App 中继续。';
        this.publish();
      }
    });
    content.on('will-redirect', (event, redirectUrl) => {
      if (!redirectUrl.startsWith('https://')) {
        event.preventDefault();
        this.error =
          '官方网页试图跳转到非 HTTPS 地址，已阻止。请在原生 App 或系统浏览器中核对后继续。';
        this.publish();
      }
    });
    content.setWindowOpenHandler(({ url }) => {
      if (!officialUrl(target.platform, url)) {
        this.error =
          '页面请求打开新窗口。为保护当前会话，未自动打开跨站弹窗；如影响结账，请改用系统浏览器或官方 App。';
        this.publish();
        return { action: 'deny' };
      }
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          parent: this.window ?? undefined,
          webPreferences: {
            session: browserSession,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    });
    content.on('did-create-window', (child) => {
      child.setMenu(null);
      child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      child.webContents.on('will-navigate', (event, navigationUrl) => {
        if (!officialUrl(target.platform, navigationUrl)) event.preventDefault();
      });
      child.webContents.on('will-redirect', (event, redirectUrl) => {
        if (!officialUrl(target.platform, redirectUrl)) event.preventDefault();
      });
    });
    content.on('did-start-loading', () => {
      this.error = '';
      this.publish();
    });
    content.on('did-stop-loading', () => this.publish());
    content.on('did-navigate', () => this.publish());
    content.on('did-navigate-in-page', () => this.publish());
    content.on('did-fail-load', (_event, code, description, url, mainFrame) => {
      if (!mainFrame || code === -3) return;
      this.error = `页面加载失败（${code}）：${description}。可使用系统浏览器打开原入口。`;
      this.publish();
    });
    const hostWindow = this.window;
    const hostedView = this.view;
    hostWindow.contentView.addChildView(hostedView);
    this.bounds();
    hostWindow.on('resize', () => this.bounds());
    hostWindow.on('closed', () => {
      if (!hostedView.webContents.isDestroyed()) hostedView.webContents.close();
      if (this.window === hostWindow) {
        this.view = null;
        this.window = null;
        this.target = null;
      }
    });
    void hostWindow.loadFile(join(__dirname, '../../dist/browser.html'));
    void content.loadURL(target.url).catch((error: unknown) => {
      this.error = error instanceof Error ? error.message : '官方页面无法加载';
      this.publish();
    });
  }
}
