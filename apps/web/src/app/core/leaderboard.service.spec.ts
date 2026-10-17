import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LeaderboardService } from './leaderboard.service';
import { LocalStore } from './local-store';
import { MemoryStore } from './memory-store';

const board = { game: 'queens', kind: 'daily', period: 'today', date: null, entries: [], me: null };

describe('LeaderboardService', () => {
  let api: LeaderboardService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('zenigma.boards');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LocalStore, useValue: new MemoryStore() }] });
    api = TestBed.inject(LeaderboardService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http?.verify());

  it('asks the server once for the same board within a minute, and for several callers at once', async () => {
    const a = api.board('queens', 'daily', 'today');
    const b = api.board('queens', 'daily', 'today');
    http.expectOne((r) => r.url.endsWith('/leaderboards/queens')).flush(board);
    await Promise.all([a, b]);

    await api.board('queens', 'daily', 'today'); // reused: no request
    http.expectNone((r) => r.url.endsWith('/leaderboards/queens'));
    expect(api.peekBoard('queens', 'daily', 'today')?.game).toBe('queens');
  });

  it('keeps boards apart by choice, and can forget them all', async () => {
    const a = api.board('queens', 'daily', 'today');
    http.expectOne((r) => r.url.endsWith('/leaderboards/queens')).flush(board);
    await a;
    expect(api.peekBoard('queens', 'daily', 'week')).toBeNull();
    api.clearBoards();
    expect(api.peekBoard('queens', 'daily', 'today')).toBeNull();
  });
});
