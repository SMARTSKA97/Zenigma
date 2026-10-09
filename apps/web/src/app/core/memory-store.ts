import { byCreatedAsc, LocalStore } from './local-store';
import { StoredEvent } from './types';

/** In-memory store: used by tests and as a fallback when IndexedDB is unavailable. */
export class MemoryStore extends LocalStore {
  private readonly meta = new Map<string, unknown>();
  private readonly events = new Map<string, StoredEvent>();

  async getMeta<T>(key: string): Promise<T | undefined> {
    return this.meta.get(key) as T | undefined;
  }

  async setMeta<T>(key: string, value: T): Promise<void> {
    this.meta.set(key, value);
  }

  async deleteMeta(key: string): Promise<void> {
    this.meta.delete(key);
  }

  async putEvents(events: StoredEvent[]): Promise<void> {
    for (const e of events) this.events.set(e.id, { ...e });
  }

  async pendingEvents(limit: number): Promise<StoredEvent[]> {
    return [...this.events.values()]
      .filter((e) => e.pending === 1)
      .sort(byCreatedAsc)
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  async markSynced(ids: string[]): Promise<void> {
    for (const id of ids) {
      const e = this.events.get(id);
      if (e) this.events.set(id, { ...e, pending: 0 });
    }
  }

  async pendingCount(): Promise<number> {
    return [...this.events.values()].filter((e) => e.pending === 1).length;
  }

  async allEvents(): Promise<StoredEvent[]> {
    return [...this.events.values()].sort(byCreatedAsc).reverse().map((e) => ({ ...e }));
  }

  async reset(keepMetaKeys: string[]): Promise<void> {
    this.events.clear();
    for (const key of [...this.meta.keys()]) {
      if (!keepMetaKeys.includes(key)) this.meta.delete(key);
    }
  }
}
