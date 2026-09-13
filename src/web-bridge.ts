import { resolveBrowserTarget } from '../shared/browser';
import type { EventRecord, PlatformId } from '../shared/model';
import { officialUrl, validateEvent } from '../shared/rules';

const storageKey = 'ticket-window:web-events:v1';
const changed = new EventTarget();

function read(): EventRecord[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    const events: unknown = JSON.parse(raw);
    if (!Array.isArray(events)) throw new Error('格式无效');
    return events as EventRecord[];
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
  const opened = window.open('about:blank', '_blank');
  if (!opened) throw new Error('浏览器拦截了新标签页。请允许本站弹出窗口后重试。');
  opened.opener = null;
  opened.location.replace(url);
}

export function installWebBridge(): void {
  if (window.ticket) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
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
    openInside: async (eventId, opportunityId) => {
      const target = resolveBrowserTarget(read(), eventId, opportunityId);
      openOfficial(target.platform, target.url);
    },
    clearBrowserData: async () => {
      throw new Error('浏览器版不能清除其他网站的登录数据；请使用浏览器自身的站点设置。');
    },
    usbStatus: async () => '浏览器版无法读取 USB 设备。请使用 Windows 桌面版。',
    launchDamai: async () => '浏览器版无法唤起 Android App。请使用 Windows 桌面版。',
    onChanged: (callback) => {
      const listener = () => callback();
      changed.addEventListener('changed', listener);
      return () => changed.removeEventListener('changed', listener);
    },
  };
}
