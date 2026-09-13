import type { EventRecord, PlatformId } from '../shared/model';
declare global {
  interface Window {
    ticket: {
      list(): Promise<EventRecord[]>;
      save(event: EventRecord): Promise<EventRecord>;
      remove(id: string): Promise<void>;
      openOfficial(platform: PlatformId, url: string): Promise<void>;
      usbStatus(): Promise<string>;
      launchDamai(): Promise<string>;
      onChanged(callback: () => void): () => void;
    };
  }
}
export {};
