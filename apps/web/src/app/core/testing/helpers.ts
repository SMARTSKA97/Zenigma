import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { StoredEvent } from '../types';

export const makeEvent = (over: Partial<StoredEvent> = {}): StoredEvent => ({
  id: crypto.randomUUID(),
  deviceId: 'device-1',
  kind: 'note.created',
  payload: { text: 'hello' },
  clientCreatedAt: new Date().toISOString(),
  pending: 1,
  ...over,
});

/** Waits (a few macrotasks) for the code under test to make a request, then returns it. */
export async function nextRequest(http: HttpTestingController, endsWith: string): Promise<TestRequest> {
  for (let i = 0; i < 100; i++) {
    const found = http.match((r) => r.url.endsWith(endsWith));
    if (found.length > 0) return found[0];
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`No request ending with ${endsWith} was made`);
}

export const sessionFor = (id = 'user-1') => ({
  accessToken: 'access-1',
  accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
  refreshToken: 'refresh-1',
  user: { id, email: `${id}@example.com`, displayName: 'Tester' },
});
