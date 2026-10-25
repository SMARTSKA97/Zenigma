import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LocalStore } from './local-store';
import { MemoryStore } from './memory-store';
import { UpNextService } from './up-next.service';

describe('UpNextService', () => {
  it('lists the unplayed mind set and holds back the extras until both halves of today are done', () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: LocalStore, useValue: new MemoryStore() }] });
    const items = TestBed.inject(UpNextService).items();
    expect(items.filter((i) => i.group === 'Mind set').length).toBe(6);
    expect(items.every((i) => i.link.startsWith('/mind/'))).toBe(true);
    expect(items.some((i) => i.group === 'Extra dailies')).toBe(false);
  });
});
