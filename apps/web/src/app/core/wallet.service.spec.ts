import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStore } from './local-store';
import { MemoryStore } from './memory-store';
import { ConnectionService } from './connection.service';
import { EARNS, WalletService } from './wallet.service';

describe('WalletService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LocalStore, useValue: new MemoryStore() }] });
  });

  it('pays once per thing that earned it', () => {
    const wallet = TestBed.inject(WalletService);
    wallet.earn('level', 'level:t:1');
    wallet.earn('level', 'level:t:1');
    wallet.earn('level', 'level:t:2');
    expect(wallet.coins()).toBe(EARNS['level'] * 2);
    expect(wallet.burst()?.amount).toBe(EARNS['level']);
  });

  it('keeps the balance across a restart', () => {
    TestBed.inject(WalletService).earn('daily', 'daily:queens:2026-10-20');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LocalStore, useValue: new MemoryStore() }] });
    expect(TestBed.inject(WalletService).coins()).toBe(EARNS['daily']);
  });

  it('knows the supporter tier from the owned items, and keeps it offline', () => {
    const wallet = TestBed.inject(WalletService);
    expect(wallet.supporterTier()).toBeNull();
    wallet.serverOwned.set(['badge:supporter', 'accent:patron']);
    expect(wallet.supporterTier()).toBe('supporter');
    wallet.serverOwned.set(['badge:supporter', 'badge:patron', 'skin:aurora']);
    expect(wallet.supporterTier()).toBe('patron');
    wallet.serverOwned.set(['badge:supporter', 'badge:patron', 'badge:champion']);
    expect(wallet.supporterTier()).toBe('champion');
  });

  it('quests pay when done and the chest pays for all three', () => {
    const wallet = TestBed.inject(WalletService);
    wallet.note('daily');
    expect(wallet.questsDone()).toBe(1);
    const afterOne = wallet.coins();
    expect(afterOne).toBeGreaterThanOrEqual(EARNS['quest']);
    for (let i = 0; i < 5; i++) wallet.note('levels');
    for (let i = 0; i < 3; i++) wallet.note('mind');
    expect(wallet.questsDone()).toBe(3);
    expect(wallet.coins()).toBe(EARNS['quest'] * 3 + EARNS['chest']); // three quests and the chest
  });
});

describe('ConnectionService hold', () => {
  it('shuts the connection while practice is open and reopens it on release', () => {
    const conn = new ConnectionService();
    conn.server.set('ready');
    expect(conn.serverReady()).toBe(true);
    const release = conn.hold();
    expect(conn.paused()).toBe(true);
    expect(conn.serverReady()).toBe(false);
    release();
    release(); // letting go twice is harmless
    expect(conn.paused()).toBe(false);
    expect(conn.serverReady()).toBe(true);
  });
});
