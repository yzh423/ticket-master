import { contextBridge, ipcRenderer } from 'electron';
import type { BrowserState } from '../shared/browser';
import type { DiscoveredEvent } from '../shared/discovery';

contextBridge.exposeInMainWorld('officialBrowser', {
  state: (): Promise<BrowserState> => ipcRenderer.invoke('browser:state'),
  back: (): Promise<void> => ipcRenderer.invoke('browser:back'),
  forward: (): Promise<void> => ipcRenderer.invoke('browser:forward'),
  close: (): Promise<void> => ipcRenderer.invoke('browser:close'),
  external: (): Promise<void> => ipcRenderer.invoke('browser:external'),
  inspectCurrent: (): Promise<DiscoveredEvent> => ipcRenderer.invoke('browser:inspect-current'),
  useCurrent: (expectedUrl: string): Promise<DiscoveredEvent> =>
    ipcRenderer.invoke('browser:use-current', expectedUrl),
  onChanged: (callback: (state: BrowserState) => void): (() => void) => {
    const listener = (_event: unknown, state: BrowserState) => callback(state);
    ipcRenderer.on('browser:changed', listener);
    return () => ipcRenderer.removeListener('browser:changed', listener);
  },
});
