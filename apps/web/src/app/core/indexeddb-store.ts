import { byCreatedAsc, LocalStore } from './local-store';
import { StoredEvent } from './types';

const DB_NAME = 'zenigma';
const DB_VERSION = 1;
const META = 'meta';
const EVENTS = 'events';

const wrap = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const finished = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export class IndexedDbStore extends LocalStore {
  private db?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(META);
        const events = db.createObjectStore(EVENTS, { keyPath: 'id' });
        events.createIndex('pending', 'pending');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const db = await this.open();
    return (await wrap(db.transaction(META).objectStore(META).get(key))) as T | undefined;
  }

  async setMeta<T>(key: string, value: T): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).put(value, key);
    await finished(tx);
  }

  async deleteMeta(key: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).delete(key);
    await finished(tx);
  }

  async putEvents(events: StoredEvent[]): Promise<void> {
    if (events.length === 0) return;
    const db = await this.open();
    const tx = db.transaction(EVENTS, 'readwrite');
    const store = tx.objectStore(EVENTS);
    for (const e of events) store.put(e);
    await finished(tx);
  }

  async pendingEvents(limit: number): Promise<StoredEvent[]> {
    const db = await this.open();
    const all = await wrap(db.transaction(EVENTS).objectStore(EVENTS).index('pending').getAll(1));
    return (all as StoredEvent[]).sort(byCreatedAsc).slice(0, limit);
  }

  async markSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await this.open();
    const tx = db.transaction(EVENTS, 'readwrite');
    const store = tx.objectStore(EVENTS);
    for (const id of ids) {
      const existing = (await wrap(store.get(id))) as StoredEvent | undefined;
      if (existing) store.put({ ...existing, pending: 0 });
    }
    await finished(tx);
  }

  async pendingCount(): Promise<number> {
    const db = await this.open();
    return wrap(db.transaction(EVENTS).objectStore(EVENTS).index('pending').count(1));
  }

  async allEvents(): Promise<StoredEvent[]> {
    const db = await this.open();
    const all = (await wrap(db.transaction(EVENTS).objectStore(EVENTS).getAll())) as StoredEvent[];
    return all.sort(byCreatedAsc).reverse();
  }

  async reset(keepMetaKeys: string[]): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([EVENTS, META], 'readwrite');
    tx.objectStore(EVENTS).clear();
    const meta = tx.objectStore(META);
    const keys = (await wrap(meta.getAllKeys())) as string[];
    for (const key of keys) {
      if (!keepMetaKeys.includes(key)) meta.delete(key);
    }
    await finished(tx);
  }
}
