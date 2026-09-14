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
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { TicketStore } from './store';
import { OfficialBrowserManager } from './official-browser';
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
import { platformLabels, saleLabels, type EventRecord, type PlatformId } from '../shared/model';

const run = promisify(execFile);
if (!app.isPackaged && process.env.TICKET_WINDOW_TEST_DATA_DIR)
  app.setPath('userData', process.env.TICKET_WINDOW_TEST_DATA_DIR);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
let store: TicketStore;
let window: BrowserWindow | null = null;
let officialBrowser: OfficialBrowserManager;
const adb = async (args: string[]): Promise<string> => {
  const result = await run('adb', args, { timeout: 7000, windowsHide: true });
  return result.stdout;
};

async function connectedAndroid(): Promise<string | null> {
  const output = await adb(['devices']);
  const line = output.split(/\r?\n/).find((row) => /^\S+\s+device$/.test(row.trim()));
  return line?.trim().split(/\s+/)[0] ?? null;
}

async function usbStatus(): Promise<string> {
  try {
    const output = await adb(['devices']);
    const lines = output
      .split(/\r?\n/)
      .filter((row) => /^\S+\s+(device|unauthorized|offline)$/.test(row.trim()));
    if (!lines.length)
      return '没有检测到 Android 设备。请连接 USB、安装 Android Platform Tools 并开启 USB 调试。';
    return lines
      .map((line) =>
        line
          .trim()
          .replace(/\s+device$/, ' · 已授权')
          .replace(/\s+unauthorized$/, ' · 等待手机授权')
          .replace(/\s+offline$/, ' · 离线'),
      )
      .join('\n');
  } catch {
    return '未找到 adb。安装 Android Platform Tools 后重启应用；这不影响 Windows 端任务管理。';
  }
}

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
      ipcMain.handle('browser:clear-data', async (event, platform: PlatformId) => {
        forMain(event.sender);
        if (!Object.hasOwn(platformLabels, platform) || platform === 'other')
          throw new Error('请选择已支持的平台');
        if (officialBrowser.isOpenFor(platform))
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
          const serial = await connectedAndroid();
          if (!serial) return '没有已授权的 Android 设备。';
          const installed = await adb(['-s', serial, 'shell', 'pm', 'path', 'cn.damai']);
          if (!installed.includes('package:'))
            return '未检测到大麦 App；请自行从官方渠道安装并在手机上打开。';
          await adb(['-s', serial, 'shell', 'monkey', '-p', 'cn.damai', '1']);
          return '已尝试打开大麦 App。请在手机上人工核对活动、场次及订单。';
        } catch {
          return '无法确认手机上的大麦 App。请人工打开，USB 功能不影响其他任务。';
        }
      });
      createWindow();
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
