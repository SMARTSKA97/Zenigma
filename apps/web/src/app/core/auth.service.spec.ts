import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { LocalStore } from './local-store';
import { MemoryStore } from './memory-store';
import { makeEvent, nextRequest, sessionFor } from './testing/helpers';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: LocalStore, useValue: store },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('signs in, persists the session and restores it on next start', async () => {
    const done = auth.login('a@example.com', 'secret-pass');
    const request = await nextRequest(http, '/auth/login');
    expect(request.request.body.email).toBe('a@example.com');
    expect(request.request.body.deviceId).toBeTruthy();
    request.flush(sessionFor('user-1'));
    await done;

    expect(auth.signedIn()).toBe(true);
    auth.session.set(null);
    await auth.restore();
    expect(auth.user()?.id).toBe('user-1');
  });

  it('keeps guest data when the first account signs in', async () => {
    await store.putEvents([makeEvent({ id: 'guest-note' })]);
    const done = auth.login('a@example.com', 'secret-pass');
    (await nextRequest(http, '/auth/login')).flush(sessionFor('user-1'));
    await done;
    expect(await store.pendingCount()).toBe(1);
  });

  it('wipes data owned by a different account before signing in as someone else', async () => {
    await store.setMeta('ownerId', 'user-1');
    await store.putEvents([makeEvent({ id: 'user-1-note' })]);

    const done = auth.login('b@example.com', 'secret-pass');
    (await nextRequest(http, '/auth/login')).flush(sessionFor('user-2'));
    await done;

    expect(await store.allEvents()).toHaveLength(0);
    expect(await store.getMeta('ownerId')).toBe('user-2');
  });

  it('ends the session only when the server rejects the refresh token', async () => {
    auth.session.set(sessionFor());
    const done = auth.refresh();
    (await nextRequest(http, '/auth/refresh')).flush({ title: 'invalid' }, { status: 401, statusText: 'Unauthorized' });
    expect(await done).toBeNull();
    expect(auth.signedIn()).toBe(false);
    expect(auth.sessionExpired()).toBe(true);
  });

  it('keeps the session when refresh fails because the network is down', async () => {
    auth.session.set(sessionFor());
    const done = auth.refresh();
    (await nextRequest(http, '/auth/refresh')).error(new ProgressEvent('error'), { status: 0 });
    expect(await done).toBeNull();
    expect(auth.signedIn()).toBe(true);
    expect(auth.sessionExpired()).toBe(false);
  });

  it('refreshes once and retries a request that got 401', async () => {
    auth.session.set(sessionFor());
    const client = TestBed.inject(HttpClient);
    const result = firstValueFrom(client.get<{ ok: boolean }>('http://localhost:5080/sync/pull'));

    const first = await nextRequest(http, '/sync/pull');
    expect(first.request.headers.get('Authorization')).toBe('Bearer access-1');
    first.flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = await nextRequest(http, '/auth/refresh');
    refresh.flush({ ...sessionFor(), accessToken: 'access-2', refreshToken: 'refresh-2' });

    const retry = await nextRequest(http, '/sync/pull');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('surfaces the original 401 when the refresh is refused', async () => {
    auth.session.set(sessionFor());
    const client = TestBed.inject(HttpClient);
    const result = firstValueFrom(client.get('http://localhost:5080/sync/pull')).catch((e) => e);

    (await nextRequest(http, '/sync/pull')).flush({}, { status: 401, statusText: 'Unauthorized' });
    (await nextRequest(http, '/auth/refresh')).flush({}, { status: 401, statusText: 'Unauthorized' });

    const error = await result;
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(401);
  });

  it('signing out clears the session and local data but keeps the device id', async () => {
    await store.setMeta('deviceId', 'device-xyz');
    await store.putEvents([makeEvent()]);
    auth.session.set(sessionFor());

    const done = auth.logout();
    (await nextRequest(http, '/auth/logout')).flush({});
    await done;

    expect(auth.signedIn()).toBe(false);
    expect(await store.allEvents()).toHaveLength(0);
    expect(await store.getMeta('deviceId')).toBe('device-xyz');
  });
});
