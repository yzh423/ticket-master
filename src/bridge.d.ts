import type { EventRecord, PlatformId, PurchaseChannel } from '../shared/model';
import type { BrowserState } from '../shared/browser';
import type { DiscoveredEvent, DiscoveryViewState } from '../shared/discovery';
import type { DiscoveryBounds } from '../electron/inline-discovery';
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
      openReference(eventId: string, opportunityId?: string): Promise<void>;
      openKnowledgeSource(id: string): Promise<void>;
      openInside(eventId: string, opportunityId?: string): Promise<void>;
      discover(platform: PlatformId, input: string): Promise<void>;
      discoveryState(): Promise<DiscoveryViewState | null>;
      discoveryBounds(bounds: DiscoveryBounds | null): Promise<void>;
      discoveryBack(): Promise<void>;
      discoverySwitch(platform: PlatformId): Promise<void>;
      discoveryForward(): Promise<void>;
      discoveryClose(): Promise<void>;
      discoveryExternal(): Promise<void>;
      discoveryInspect(): Promise<DiscoveredEvent>;
      onDiscoveryChanged(callback: (state: DiscoveryViewState | null) => void): () => void;
      onDiscovered(callback: (event: DiscoveredEvent) => void): () => void;
      clearBrowserData(platform: PlatformId): Promise<void>;
      usbStatus(): Promise<string>;
      launchDamai(): Promise<string>;
      openOfficialOnAndroid(
        platform: PlatformId,
        url: string,
        channel?: PurchaseChannel,
      ): Promise<string>;
      openDeviceHelp(kind: 'android' | 'iphone'): Promise<void>;
      exportBackup?(): Promise<string>;
      importBackup?(raw: string): Promise<number>;
      onChanged(callback: () => void): () => void;
    };
    officialBrowser: {
      state(): Promise<BrowserState>;
      back(): Promise<void>;
      forward(): Promise<void>;
      close(): Promise<void>;
      external(): Promise<void>;
      inspectCurrent(): Promise<DiscoveredEvent>;
      useCurrent(expectedUrl: string): Promise<DiscoveredEvent>;
      onChanged(callback: (state: BrowserState) => void): () => void;
    };
  }
}
export {};
