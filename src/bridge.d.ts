import type { EventRecord, PlatformId } from '../shared/model';
import type { BrowserState } from '../shared/browser';
declare global {
  interface Window {
    ticket: {
      environment: 'desktop' | 'web';
      list(): Promise<EventRecord[]>;
      recoveryStatus(): Promise<boolean>;
      setTheme(theme: 'light' | 'dark'): Promise<void>;
      save(event: EventRecord): Promise<EventRecord>;
      remove(id: string): Promise<void>;
      openOfficial(platform: PlatformId, url: string): Promise<void>;
      openInside(eventId: string, opportunityId?: string): Promise<void>;
      clearBrowserData(platform: PlatformId): Promise<void>;
      usbStatus(): Promise<string>;
      launchDamai(): Promise<string>;
      onChanged(callback: () => void): () => void;
    };
    officialBrowser: {
      state(): Promise<BrowserState>;
      back(): Promise<void>;
      forward(): Promise<void>;
      close(): Promise<void>;
      external(): Promise<void>;
      onChanged(callback: (state: BrowserState) => void): () => void;
    };
  }
}
export {};
