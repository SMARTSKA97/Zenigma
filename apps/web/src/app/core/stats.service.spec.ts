import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ConnectionService } from './connection.service';
import { LocalStore } from './local-store';
import { MemoryStore } from './memory-store';
import { Stats, StatsService } from './stats.service';
import { nextRequest, sessionFor } from './testing/helpers';

describe('StatsService', () => {
  const awake = signal(false);
  const stats: Stats = { date: '2026-10-17', rewards: { freezes: 1, maxFreezes: 2, daysPerFreeze: 7 }, games: [] };
  let service: StatsService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('zenigma.stats');
    awake.set(false);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LocalStore, useValue: new MemoryStore() },
        { provide: ConnectionService, useValue: { offlineMode: signal(false), serverReady: awake, onWake: () => {}, wake: () => Promise.resolve(true) } }],
    });
    TestBed.inject(AuthService).session.set(sessionFor());
    service = TestBed.inject(StatsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('makes no request while the server sleeps, and has nothing saved yet', async () => {
    expect(await service.refreshIfAwake()).toBeNull();
    http.expectNone(() => true);
    expect(service.peek()).toBeNull();
  });

  it('remembers the last stats for this player so Home can draw without asking', async () => {
    awake.set(true);
    const done = service.refreshIfAwake();
    (await nextRequest(http, '/stats')).flush(stats);
    await done;
    expect(service.peek()).toEqual(stats);
    TestBed.inject(AuthService).session.set(sessionFor('user-2'));
    expect(service.peek()).toBeNull();
  });
});
