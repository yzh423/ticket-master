import { contextBridge, ipcRenderer } from 'electron';
import type { EventRecord, PlatformId } from '../shared/model';

contextBridge.exposeInMainWorld('ticket', {
  list: (): Promise<EventRecord[]> => ipcRenderer.invoke('events:list'),
  save: (event: EventRecord): Promise<EventRecord> => ipcRenderer.invoke('events:save', event),
  remove: (id: string): Promise<void> => ipcRenderer.invoke('events:remove', id),
  openOfficial: (platform: PlatformId, url: string): Promise<void> =>
    ipcRenderer.invoke('official:open', platform, url),
  openInside: (eventId: string, opportunityId?: string): Promise<void> =>
    ipcRenderer.invoke('official:open-inside', eventId, opportunityId),
  clearBrowserData: (platform: PlatformId): Promise<void> =>
    ipcRenderer.invoke('browser:clear-data', platform),
  usbStatus: (): Promise<string> => ipcRenderer.invoke('android:status'),
  launchDamai: (): Promise<string> => ipcRenderer.invoke('android:damai'),
  onChanged: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('events:changed', listener);
    return () => ipcRenderer.removeListener('events:changed', listener);
  },
});
