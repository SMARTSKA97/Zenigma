import { StoredEvent } from './types';

/**
 * Everything the app knows lives here, on the device. Screens and services read and write only
 * this store; the sync engine reconciles it with the server whenever a connection exists.
 * Android and web both use IndexedDB for now; a SQLite adapter can replace it behind this class.
 */
export abstract class LocalStore {
  abstract getMeta<T>(key: string): Promise<T | undefined>;
  abstract setMeta<T>(key: string, value: T): Promise<void>;
  abstract deleteMeta(key: string): Promise<void>;

  /** Insert or replace events by id. */
  abstract putEvents(events: StoredEvent[]): Promise<void>;
  /** Oldest first, at most `limit`. */
  abstract pendingEvents(limit: number): Promise<StoredEvent[]>;
  abstract markSynced(ids: string[]): Promise<void>;
  abstract pendingCount(): Promise<number>;
  /** Newest first. */
  abstract allEvents(): Promise<StoredEvent[]>;

  /** Remove every event and every meta key except the ones listed. */
  abstract reset(keepMetaKeys: string[]): Promise<void>;
}

/** Orders events oldest first, using the id as a stable tie-break. */
export function byCreatedAsc(a: StoredEvent, b: StoredEvent): number {
  return a.clientCreatedAt.localeCompare(b.clientCreatedAt) || a.id.localeCompare(b.id);
}
