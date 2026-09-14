import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  nativeTheme,
  session,
  shell,
  type WebContents,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TicketStore } from './store';
import { OfficialBrowserManager } from './official-browser';
import { InlineDiscovery, type DiscoveryBounds } from './inline-discovery';
import { launchDamai, openOfficialOnAndroid, usbStatus } from './device';
import { resolveBrowserTarget } from '../shared/browser';
import { marketSource } from '../shared/market';
import {
  formatLocalInstant,
  officialUrl,
  opportunityDeadlineRemindersDue,
  paymentRemindersDue,
  pendingPaymentAttempts,
  referenceUrl,
  remindersDue,
} from '../shared/rules';
import {
  platformLabels,
  saleLabels,
  type EventRecord,
  type PlatformId,
  type PurchaseChannel,
} from '../shared/model';

if (!app.isPackaged && process.env.TICKET_WINDOW_TEST_DATA_DIR)
  app.setPath('userData', process.env.TICKET_WINDOW_TEST_DATA_DIR);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
let store: TicketStore;
let window: BrowserWindow | null = null;
let officialBrowser: OfficialBrowserManager;
let inlineDiscovery: InlineDiscovery;
function notifyDue(): void {
  if (!Notification.isSupported()) return;
  const now = Date.now();
  for (const event of store.list()) {
    for (const attempt of pendingPaymentAttempts(event.attempts)) {
      const deadline = attempt.paymentDeadline;
      if (!deadline) continue;
      for (const lead of paymentRemindersDue(deadline, now)) {
        showReminder(
          `${attempt.id}:payment`,
          deadline,
          lead,
          `${event.title} · 待支付订单`,
          `你记录的支付截止时间即将到达。请立即在官方订单页核对并完成付款；以平台当前倒计时为准。`,
        );
      }
    }
    if (Date.parse(event.followUntil) < now) continue;
    for (const opportunity of event.opportunities) {
      if (opportunity.status === 'missed' || opportunity.status === 'completed') continue;
      for (const lead of remindersDue(opportunity.startsAt, now, new Set())) {
        showReminder(
          opportunity.id,
          opportunity.startsAt,
          lead,
          `${event.title} · ${saleLabels[opportunity.type]}`,
          `官方公告开始时间：${formatLocalInstant(opportunity.startsAt, opportunity.timeZone)} ${opportunity.timeZone}。请核对当前页面并按原平台规则参与。`,
        );
      }
      if (
        opportunity.endsAt &&
        (opportunity.type === 'invitation' || opportunity.type === 'waitlist')
      ) {
        for (const lead of opportunityDeadlineRemindersDue(
          opportunity.startsAt,
          opportunity.endsAt,
          now,
        )) {
          showReminder(
            `${opportunity.id}:deadline`,
            opportunity.endsAt,
            lead,
            `${event.title} · 响应截止提醒`,
            `官方机会截止：${formatLocalInstant(opportunity.endsAt, opportunity.timeZone)} ${opportunity.timeZone}。请在原平台核对并处理。`,
          );
        }
      }
    }
  }
}

function showReminder(id: string, at: string, lead: string, title: string, body: string): void {
  if (store.hasReminder(id, at, lead)) return;
  try {
    new Notification({ title, body }).show();
    store.markReminder(id, at, lead);
  } catch (error) {
    console.error('桌面提醒未成功发送', error);
  }
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1260,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#0a111a',
    icon: join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.loadFile(join(__dirname, '../../dist/index.html'));
  window.on('closed', () => {
    window = null;
  });
}

function forMain(sender: WebContents): void {
  if (!window || window.isDestroyed() || sender !== window.webContents)
    throw new Error('页面来源无效');
}

app.on('second-instance', () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});
if (singleInstance)
  app
    .whenReady()
    .then(async () => {
      store = await TicketStore.open(join(app.getPath('userData'), 'tickets.sqlite'));
      officialBrowser = new OfficialBrowserManager();
      ipcMain.handle('events:list', (event) => {
        forMain(event.sender);
        return store.list();
      });
      ipcMain.handle('events:recovery-status', (event) => {
        forMain(event.sender);
        return store.recoveredFromBackup;
      });
      ipcMain.handle('ui:set-theme', (event, theme: 'light' | 'dark') => {
        forMain(event.sender);
        if (theme !== 'light' && theme !== 'dark') throw new Error('外观设置无效');
        nativeTheme.themeSource = theme;
      });
      ipcMain.handle('events:save', (event, value: EventRecord) => {
        forMain(event.sender);
        const existing = store.list().find((item) => item.id === value?.id);
        const record = store.save({
          ...value,
          id: existing?.id ?? value.id ?? randomUUID(),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        window?.webContents.send('events:changed');
        return record;
      });
      ipcMain.handle('events:remove', (event, id: string) => {
        forMain(event.sender);
        if (typeof id !== 'string' || id.length > 100) throw new Error('任务 ID 无效');
        store.remove(id);
        window?.webContents.send('events:changed');
      });
      ipcMain.handle('official:open', async (event, platform: PlatformId, url: string) => {
        forMain(event.sender);
        if (!officialUrl(platform, url)) throw new Error('该入口未通过官方域名检查，请先核对来源');
        await shell.openExternal(url);
      });
      ipcMain.handle('reference:open', async (event, eventId: string, opportunityId?: string) => {
        forMain(event.sender);
        const task = store.list().find((item) => item.id === eventId);
        if (!task) throw new Error('任务已不存在');
        const source = opportunityId
          ? task.opportunities.find((item) => item.id === opportunityId)?.sourceUrl
          : task.sourceUrl;
        if (!source || !referenceUrl(source)) throw new Error('规则来源地址无效');
        await shell.openExternal(source);
      });
      ipcMain.handle('knowledge:open', async (event, id: string) => {
        forMain(event.sender);
        await shell.openExternal(marketSource(id));
      });
      ipcMain.handle('official:open-inside', (event, eventId: string, opportunityId?: string) => {
        forMain(event.sender);
        const target = resolveBrowserTarget(store.list(), eventId, opportunityId);
        officialBrowser.open(target);
      });
      ipcMain.handle('official:discover', (event, platform: PlatformId, input: string) => {
        forMain(event.sender);
        if (typeof input !== 'string') throw new Error('搜索内容无效');
        inlineDiscovery.open(platform, input);
      });
      ipcMain.handle('discovery:state', (event) => {
        forMain(event.sender);
        return inlineDiscovery.state();
      });
      ipcMain.handle('discovery:bounds', (event, bounds: DiscoveryBounds | null) => {
        forMain(event.sender);
        inlineDiscovery.setBounds(bounds);
      });
      ipcMain.handle('discovery:back', (event) => {
        forMain(event.sender);
        inlineDiscovery.back();
      });
      ipcMain.handle('discovery:switch', (event, platform: PlatformId) => {
        forMain(event.sender);
        inlineDiscovery.switch(platform);
      });
      ipcMain.handle('discovery:forward', (event) => {
        forMain(event.sender);
        inlineDiscovery.forward();
      });
      ipcMain.handle('discovery:close', (event) => {
        forMain(event.sender);
        inlineDiscovery.close();
      });
      ipcMain.handle('discovery:external', async (event) => {
        forMain(event.sender);
        await inlineDiscovery.external();
      });
      ipcMain.handle('discovery:inspect', async (event) => {
        forMain(event.sender);
        return inlineDiscovery.inspect();
      });
      ipcMain.handle('browser:inspect-current', (event) =>
        officialBrowser.inspectCurrent(event.sender),
      );
      ipcMain.handle('browser:use-current', async (event, expectedUrl: string) => {
        const discovered = await officialBrowser.inspectCurrent(event.sender);
        if (discovered.eventUrl !== expectedUrl)
          throw new Error('活动页面已变化，请重新识别当前活动');
        if (!window || window.isDestroyed()) throw new Error('主窗口已关闭');
        window.webContents.send('discovery:selected', discovered);
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
        return discovered;
      });
      ipcMain.handle('browser:clear-data', async (event, platform: PlatformId) => {
        forMain(event.sender);
        if (!Object.hasOwn(platformLabels, platform) || platform === 'other')
          throw new Error('请选择已支持的平台');
        if (officialBrowser.isOpenFor(platform) || inlineDiscovery.isOpenFor(platform))
          throw new Error('请先关闭该平台的网页工作区，再清除登录数据，以免中断当前会话');
        const browserSession = session.fromPartition(`persist:ticket-${platform}`);
        await browserSession.clearStorageData();
        await browserSession.clearCache();
      });
      ipcMain.handle('android:status', (event) => {
        forMain(event.sender);
        return usbStatus();
      });
      ipcMain.handle('android:damai', async (event) => {
        forMain(event.sender);
        try {
          return await launchDamai();
        } catch (error) {
          return error instanceof Error ? error.message : '无法确认手机上的大麦 App';
        }
      });
      ipcMain.handle(
        'android:open-official',
        async (event, platform: PlatformId, url: string, channel?: PurchaseChannel) => {
          forMain(event.sender);
          return openOfficialOnAndroid(platform, url, channel);
        },
      );
      ipcMain.handle('device:help', async (event, kind: 'android' | 'iphone') => {
        forMain(event.sender);
        const urls = {
          android: 'https://developer.android.com/tools/releases/platform-tools',
          iphone: 'https://support.apple.com/en-us/108643',
        };
        if (!Object.hasOwn(urls, kind)) throw new Error('设备帮助入口无效');
        await shell.openExternal(urls[kind]);
      });
      createWindow();
      if (window) inlineDiscovery = new InlineDiscovery(window);
      setInterval(notifyDue, 15_000);
      notifyDue();
      app.on('activate', () => {
        if (!BrowserWindow.getAllWindows().length) createWindow();
      });
    })
    .catch((error) => {
      console.error('无法初始化本地数据库', error);
      app.quit();
    });

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => store?.close());
