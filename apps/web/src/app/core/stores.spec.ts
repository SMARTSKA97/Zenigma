import 'fake-indexeddb/auto';
import { IndexedDbStore } from './indexeddb-store';
import { LocalStore } from './local-store';
import { MemoryStore } from './memory-store';
import { makeEvent } from './testing/helpers';

const implementations: [string, () => LocalStore][] = [
  ['MemoryStore', () => new MemoryStore()],
  ['IndexedDbStore', () => new IndexedDbStore()],
];

describe.each(implementations)('%s', (_name, create) => {
  let store: LocalStore;

  beforeEach(async () => {
    store = create();
    await store.reset([]);
  });

  it('stores and deletes meta values', async () => {
    expect(await store.getMeta('a')).toBeUndefined();
    await store.setMeta('a', { n: 1 });
    expect(await store.getMeta('a')).toEqual({ n: 1 });
    await store.deleteMeta('a');
    expect(await store.getMeta('a')).toBeUndefined();
  });

  it('returns pending events oldest first and respects the limit', async () => {
    const t = (s: number) => new Date(2026, 0, 1, 0, 0, s).toISOString();
    await store.putEvents([
      makeEvent({ id: 'c', clientCreatedAt: t(3) }),
      makeEvent({ id: 'a', clientCreatedAt: t(1) }),
      makeEvent({ id: 'b', clientCreatedAt: t(2) }),
    ]);
    expect((await store.pendingEvents(10)).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect((await store.pendingEvents(2)).map((e) => e.id)).toEqual(['a', 'b']);
    expect(await store.pendingCount()).toBe(3);
  });

  it('marks events as synced and keeps them', async () => {
    await store.putEvents([makeEvent({ id: 'a' }), makeEvent({ id: 'b' })]);
    await store.markSynced(['a', 'missing']);
    expect(await store.pendingCount()).toBe(1);
    expect((await store.allEvents()).length).toBe(2);
  });

  it('upserts by id', async () => {
    await store.putEvents([makeEvent({ id: 'a', pending: 1 })]);
    await store.putEvents([makeEvent({ id: 'a', pending: 0, seq: 7 })]);
    const all = await store.allEvents();
    expect(all).toHaveLength(1);
    expect(all[0].seq).toBe(7);
    expect(await store.pendingCount()).toBe(0);
  });

  it('lists all events newest first', async () => {
    const t = (s: number) => new Date(2026, 0, 1, 0, 0, s).toISOString();
    await store.putEvents([makeEvent({ id: 'a', clientCreatedAt: t(1) }), makeEvent({ id: 'b', clientCreatedAt: t(2) })]);
    expect((await store.allEvents()).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('reset clears events and meta except the kept keys', async () => {
    await store.setMeta('deviceId', 'd1');
    await store.setMeta('auth', { token: 'x' });
    await store.putEvents([makeEvent()]);
    await store.reset(['deviceId']);
    expect(await store.getMeta('deviceId')).toBe('d1');
    expect(await store.getMeta('auth')).toBeUndefined();
    expect(await store.allEvents()).toHaveLength(0);
  });
});
