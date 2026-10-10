import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth.service';
import { LocalStore } from '../../core/local-store';
import { MemoryStore } from '../../core/memory-store';
import { SyncService } from '../../core/sync.service';
import { nextRequest, sessionFor } from '../../core/testing/helpers';
import { DailyStore } from './daily.store';

const attempt = (over: object = {}) => ({
  hard: false,
  status: 'playing',
  guesses: [{ word: 'slate', marks: 'aacac' }],
  startedAt: '2026-10-10T00:00:00Z',
  answer: null,
  activeOnThisDevice: true,
  ...over,
});
const state = (a: object | null) => ({ date: '2026-10-10', nextRolloverUtc: '2026-10-10T18:30:00Z', attempt: a });

describe('DailyStore', () => {
  let daily: DailyStore;
  let http: HttpTestingController;
  let auth: AuthService;
  let sync: SyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LocalStore, useValue: new MemoryStore() }],
    });
    daily = TestBed.inject(DailyStore);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    sync = TestBed.inject(SyncService);
  });

  afterEach(() => http.verify());

  it('asks guests to sign in without calling the server', async () => {
    await daily.load();
    expect(daily.phase()).toBe('signin');
    http.expectNone(() => true);
  });

  it('says offline when there is no connection', async () => {
    auth.session.set(sessionFor());
    sync.online.set(false);
    await daily.load();
    expect(daily.phase()).toBe('offline');
    http.expectNone(() => true);
  });

  async function loadWith(body: object | null, status = 200) {
    auth.session.set(sessionFor());
    const loading = daily.load();
    const req = await nextRequest(http, '/daily/word-guess');
    if (status === 200) req.flush(body);
    else req.flush(body ?? {}, { status, statusText: 'x' });
    await loading;
  }

  it('is ready to start when there is no attempt yet', async () => {
    await loadWith(state(null));
    expect(daily.phase()).toBe('ready');
    expect(daily.date()).toBe('2026-10-10');
  });

  it('restores the board and lets this device keep playing', async () => {
    await loadWith(state(attempt()));
    expect(daily.phase()).toBe('playing');
    expect(daily.rows()[0].letters.join('')).toBe('slate');
    expect(daily.rows()[0].marks).toEqual(['absent', 'absent', 'correct', 'absent', 'correct']);
    expect(daily.keyMarks().get('a')).toBe('correct');
  });

  it('is blocked while another device holds the attempt', async () => {
    await loadWith(state(attempt({ activeOnThisDevice: false })));
    expect(daily.phase()).toBe('blocked');
  });

  it('shows the result and the answer once finished', async () => {
    await loadWith(state(attempt({ status: 'won', answer: 'crane', guesses: [{ word: 'crane', marks: 'ccccc' }] })));
    expect(daily.phase()).toBe('finished');
    expect(daily.answer()).toBe('crane');
    expect(daily.share()).toContain('2026-10-10 1/6');
  });

  it('reports "not ready" when the server has no puzzle for today', async () => {
    await loadWith({ title: 'No puzzle' }, 404);
    expect(daily.phase()).toBe('unavailable');
  });
});
