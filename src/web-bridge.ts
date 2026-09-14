import { resolveBrowserTarget } from '../shared/browser';
import { marketSource } from '../shared/market';
import type { EventRecord, PlatformId } from '../shared/model';
import { officialUrl, referenceUrl, validateEvent } from '../shared/rules';

const storageKey = 'ticket-window:web-events:v1';
const backupFormat = 'ticket-window-web-backup-v1';
const changed = new EventTarget();

function read(): EventRecord[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    throw new Error('浏览器禁止读取本站数据。请检查隐私模式和站点存储权限。');
  }
  if (!raw) return [];
  try {
    const events: unknown = JSON.parse(raw);
    if (!Array.isArray(events)) throw new Error('格式无效');
    return events.map((item) => validateEvent(item as EventRecord));
  } catch {
    throw new Error('浏览器保存的任务数据无法读取。请先备份浏览器站点数据，再排查存储问题。');
  }
}

function write(events: EventRecord[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(events));
  } catch {
    throw new Error('浏览器未能保存任务。请检查隐私模式或站点存储空间。');
  }
  changed.dispatchEvent(new Event('changed'));
}

function openOfficial(platform: PlatformId, url: string): void {
  if (!officialUrl(platform, url)) throw new Error('该入口未通过官方域名检查，请先核对来源');
  openExternalTab(url);
}

function openExternalTab(url: string): void {
  const opened = window.open('about:blank', '_blank');
  if (!opened) throw new Error('浏览器拦截了新标签页。请允许本站弹出窗口后重试。');
  opened.opener = null;
  opened.location.replace(url);
}

export function installWebBridge(): void {
  if (window.ticket) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) changed.dispatchEvent(new Event('changed'));
  });
  window.ticket = {
    environment: 'web',
    list: async () => read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    recoveryStatus: async () => false,
    setTheme: async () => {},
    save: async (input: EventRecord) => {
      const events = read();
      const existing = events.find((item) => item.id === input?.id);
      const now = new Date().toISOString();
      const item = validateEvent({
        ...input,
        id: existing?.id ?? input.id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      write([...events.filter((event) => event.id !== item.id), item]);
      return item;
    },
    remove: async (id: string) => {
      if (typeof id !== 'string' || id.length > 100) throw new Error('任务 ID 无效');
      write(read().filter((event) => event.id !== id));
    },
    openOfficial: async (platform, url) => openOfficial(platform, url),
    openKnowledgeSource: async (id) => openExternalTab(marketSource(id)),
    openReference: async (eventId, opportunityId) => {
      const event = read().find((item) => item.id === eventId);
      if (!event) throw new Error('任务已不存在');
      const source = opportunityId
        ? event.opportunities.find((item) => item.id === opportunityId)?.sourceUrl
        : event.sourceUrl;
      if (!source || !referenceUrl(source)) throw new Error('规则来源地址无效');
      openExternalTab(source);
    },
    openInside: async (eventId, opportunityId) => {
      const target = resolveBrowserTarget(read(), eventId, opportunityId);
      openOfficial(target.platform, target.url);
    },
    clearBrowserData: async () => {
      throw new Error('浏览器版不能清除其他网站的登录数据；请使用浏览器自身的站点设置。');
    },
    usbStatus: async () => '浏览器版无法读取 USB 设备。请使用 Windows 桌面版。',
    launchDamai: async () => '浏览器版无法唤起 Android App。请使用 Windows 桌面版。',
    exportBackup: async () =>
      JSON.stringify(
        { format: backupFormat, exportedAt: new Date().toISOString(), events: read() },
        null,
        2,
      ),
    importBackup: async (raw) => {
      if (raw.length > 5_000_000) throw new Error('备份文件超过 5 MB，请检查文件内容');
      let backup: { format?: unknown; events?: unknown };
      try {
        backup = JSON.parse(raw);
      } catch {
        throw new Error('备份文件不是有效的 JSON');
      }
      if (backup?.format !== backupFormat || !Array.isArray(backup.events))
        throw new Error('不是候票台网页版本的备份文件');
      if (backup.events.length > 500) throw new Error('备份任务数量超出支持范围');
      const events = backup.events.map((item) => validateEvent(item as EventRecord));
      if (new Set(events.map((item) => item.id)).size !== events.length)
        throw new Error('备份中存在重复任务 ID');
      write(events);
      return events.length;
    },
    onChanged: (callback) => {
      const listener = () => callback();
      changed.addEventListener('changed', listener);
      return () => changed.removeEventListener('changed', listener);
    },
  };
}
