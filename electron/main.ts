import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { TicketStore } from './store';
import { officialUrl, remindersDue } from '../shared/rules';
import { platformLabels, saleLabels, type EventRecord, type PlatformId } from '../shared/model';

const run = promisify(execFile);
if (!app.isPackaged && process.env.TICKET_WINDOW_TEST_DATA_DIR)
  app.setPath('userData', process.env.TICKET_WINDOW_TEST_DATA_DIR);
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
let store: TicketStore;
let window: BrowserWindow | null = null;
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
    if (Date.parse(event.followUntil) < now) continue;
    for (const opportunity of event.opportunities) {
      if (opportunity.status === 'missed' || opportunity.status === 'completed') continue;
      for (const lead of remindersDue(opportunity.startsAt, now, new Set())) {
        if (!store.markReminder(opportunity.id, opportunity.startsAt, lead)) continue;
        const when =
          lead === 'now'
            ? '现在开始'
            : `将在 ${lead === '24h' ? '24 小时' : lead === '30m' ? '30 分钟' : '5 分钟'}后开始`;
        new Notification({
          title: `${event.title} · ${saleLabels[opportunity.type]}`,
          body: `${when}。按当前项目规则使用官方入口。`,
        }).show();
      }
      if (
        opportunity.endsAt &&
        (opportunity.type === 'invitation' || opportunity.type === 'waitlist')
      ) {
        for (const lead of remindersDue(opportunity.endsAt, now, new Set()).filter(
          (key) => key === '30m' || key === '5m',
        )) {
          if (!store.markReminder(`${opportunity.id}:deadline`, opportunity.endsAt, lead)) continue;
          new Notification({
            title: `${event.title} · 响应截止提醒`,
            body: `官方机会将在 ${lead === '30m' ? '30 分钟' : '5 分钟'}后截止。请在原平台核对并处理。`,
          }).show();
        }
      }
    }
  }
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1260,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#f7f6f2',
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
      ipcMain.handle('events:list', () => store.list());
      ipcMain.handle('events:save', (_e, value: EventRecord) => {
        const existing = store.list().find((item) => item.id === value?.id);
        const event = store.save({
          ...value,
          id: existing?.id ?? value.id ?? randomUUID(),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        window?.webContents.send('events:changed');
        return event;
      });
      ipcMain.handle('events:remove', (_e, id: string) => {
        if (typeof id !== 'string' || id.length > 100) throw new Error('任务 ID 无效');
        store.remove(id);
        window?.webContents.send('events:changed');
      });
      ipcMain.handle('official:open', async (_e, platform: PlatformId, url: string) => {
        if (!officialUrl(platform, url)) throw new Error('该入口未通过官方域名检查，请先核对来源');
        await shell.openExternal(url);
      });
      ipcMain.handle('android:status', usbStatus);
      ipcMain.handle('android:damai', async () => {
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
