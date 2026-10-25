import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { LocalStore } from './local-store';
import { MemoryStore } from './memory-store';
import { SupportService } from './support.service';

describe('SupportService UPI', () => {
  let s: SupportService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: LocalStore, useValue: new MemoryStore() }] });
    s = TestBed.inject(SupportService);
  });

  it('puts the amount in the UPI link and leaves it out when unset', () => {
    expect(s.upiUrl(99)).toContain('am=99');
    expect(s.upiUrl(99)).toContain('cu=INR');
    expect(s.upiUrl()).not.toContain('am=');
    expect(s.upiUrl(0)).not.toContain('am=');
  });

  it('gives each iOS app its own scheme', () => {
    const apps = s.upiApps(49);
    expect(apps[0].href.startsWith('gpay://')).toBe(true);
    expect(apps.at(-1)?.href.startsWith('upi://pay')).toBe(true);
    expect(apps.every((a) => a.href.includes('am=49'))).toBe(true);
  });

  it('remembers a started payment until it is cleared', () => {
    s.startPayment(199);
    expect(s.pending()?.amountInr).toBe(199);
    s.clearPending();
    expect(s.pending()).toBeNull();
  });

  it('makes a QR code image', async () => {
    expect((await s.qr(99)).startsWith('data:image/png')).toBe(true);
  });
});
