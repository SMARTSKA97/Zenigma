import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { LocalStore } from './local-store';
import { MemoryStore } from './memory-store';
import { SyncService } from './sync.service';
import { nextRequest, sessionFor } from './testing/helpers';

describe('SyncService', () => {
  let sync: SyncService;
  let http: HttpTestingController;
  let store: MemoryStore;
  let auth: AuthService;

  beforeEach(() => {
    store = new MemoryStore();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LocalStore, useValue: store }],
    });
    sync = TestBed.inject(SyncService);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  it('keeps a guest event in the outbox and makes no request', async () => {
    await sync.record('note.created', { text: 'offline' });
    await sync.sync();
    http.expectNone(() => true);
    expect(sync.pendingCount()).toBe(1);
    expect(sync.events()[0].pending).toBe(1);
  });

  it('pushes pending events once signed in, then pulls', async () => {
    await sync.record('note.created', { text: 'a' });
    const event = sync.events()[0];
    auth.session.set(sessionFor());

    const done = sync.sync();
    const push = await nextRequest(http, '/sync/push');
    expect(push.request.method).toBe('POST');
    expect(push.request.body.events).toHaveLength(1);
    expect(push.request.body.events[0].id).toBe(event.id);
    expect(push.request.body.deviceId).toBe(event.deviceId);
    push.flush({ accepted: [event.id], duplicates: [], rejected: [] });

    const pull = await nextRequest(http, '/sync/pull');
    expect(pull.request.params.get('after')).toBe('0');
    pull.flush({ events: [], nextCursor: 0, hasMore: false });
    await done;

    expect(sync.pendingCount()).toBe(0);
    expect(sync.lastError()).toBeNull();
    expect(sync.lastSyncedAt()).not.toBeNull();
  });

  it('leaves events pending and reports an error when the server is unreachable', async () => {
    await sync.record('note.created', { text: 'a' });
    auth.session.set(sessionFor());

    const done = sync.sync();
    const push = await nextRequest(http, '/sync/push');
    push.error(new ProgressEvent('error'), { status: 0 });
    await done;

    expect(sync.pendingCount()).toBe(1);
    expect(sync.lastError()).toContain('Offline');
  });

  it('treats duplicates as synced so they never block the outbox', async () => {
    await sync.record('note.created', { text: 'a' });
    auth.session.set(sessionFor());
    const id = sync.events()[0].id;

    const done = sync.sync();
    (await nextRequest(http, '/sync/push')).flush({ accepted: [], duplicates: [id], rejected: [] });
    (await nextRequest(http, '/sync/pull')).flush({ events: [], nextCursor: 0, hasMore: false });
    await done;

    expect(sync.pendingCount()).toBe(0);
  });

  it('drops rejected events from the outbox and surfaces why', async () => {
    await sync.record('bad kind', { text: 'a' });
    auth.session.set(sessionFor());
    const id = sync.events()[0].id;

    const done = sync.sync();
    (await nextRequest(http, '/sync/push')).flush({ accepted: [], duplicates: [], rejected: [{ id, reason: 'unknown kind' }] });
    (await nextRequest(http, '/sync/pull')).flush({ events: [], nextCursor: 0, hasMore: false });
    await done;

    expect(sync.pendingCount()).toBe(0);
  });

  it('pulls events from other devices page by page and remembers the cursor', async () => {
    auth.session.set(sessionFor());
    const pulled = (seq: number) => ({
      seq,
      id: `remote-${seq}`,
      deviceId: 'other-device',
      kind: 'note.created',
      payload: { text: `remote ${seq}` },
      clientCreatedAt: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
      receivedAt: new Date().toISOString(),
    });

    const done = sync.sync();
    const first = await nextRequest(http, '/sync/pull');
    expect(first.request.params.get('after')).toBe('0');
    first.flush({ events: [pulled(1), pulled(2)], nextCursor: 2, hasMore: true });
    const second = await nextRequest(http, '/sync/pull');
    expect(second.request.params.get('after')).toBe('2');
    second.flush({ events: [pulled(3)], nextCursor: 3, hasMore: false });
    await done;

    expect(sync.events().map((e) => e.id).sort()).toEqual(['remote-1', 'remote-2', 'remote-3']);
    expect(sync.pendingCount()).toBe(0);
    expect(await store.getMeta('syncCursor')).toBe(3);
  });

  it('folds overlapping sync calls into one extra run', async () => {
    auth.session.set(sessionFor());
    const first = sync.sync();
    const second = sync.sync();
    expect(second).toBe(first);

    (await nextRequest(http, '/sync/pull')).flush({ events: [], nextCursor: 0, hasMore: false });
    (await nextRequest(http, '/sync/pull')).flush({ events: [], nextCursor: 0, hasMore: false });
    await first;
  });
});
