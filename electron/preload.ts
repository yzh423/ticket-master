import { contextBridge, ipcRenderer } from 'electron';
import type { EventRecord, PlatformId } from '../shared/model';
import type { DiscoveredEvent } from '../shared/discovery';

contextBridge.exposeInMainWorld('ticket', {
  environment: 'desktop',
  list: (): Promise<EventRecord[]> => ipcRenderer.invoke('events:list'),
  recoveryStatus: (): Promise<boolean> => ipcRenderer.invoke('events:recovery-status'),
  setTheme: (theme: 'light' | 'dark'): Promise<void> => ipcRenderer.invoke('ui:set-theme', theme),
  save: (event: EventRecord): Promise<EventRecord> => ipcRenderer.invoke('events:save', event),
  remove: (id: string): Promise<void> => ipcRenderer.invoke('events:remove', id),
  openOfficial: (platform: PlatformId, url: string): Promise<void> =>
    ipcRenderer.invoke('official:open', platform, url),
  openReference: (eventId: string, opportunityId?: string): Promise<void> =>
    ipcRenderer.invoke('reference:open', eventId, opportunityId),
  openKnowledgeSource: (id: string): Promise<void> => ipcRenderer.invoke('knowledge:open', id),
  openInside: (eventId: string, opportunityId?: string): Promise<void> =>
    ipcRenderer.invoke('official:open-inside', eventId, opportunityId),
  discover: (input: string): Promise<void> => ipcRenderer.invoke('official:discover', input),
  onDiscovered: (callback: (event: DiscoveredEvent) => void): (() => void) => {
    const listener = (_event: unknown, discovered: DiscoveredEvent) => callback(discovered);
    ipcRenderer.on('discovery:selected', listener);
    return () => ipcRenderer.removeListener('discovery:selected', listener);
  },
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
