// Zenigma load test (k6). Run it from YOUR computer: it needs to reach the live URLs.
//
//   k6 run loadtest/k6.js                                    # public pages only, gentle
//   k6 run -e PROFILE=heavy loadtest/k6.js                   # more users (still modest for a free tier)
//   k6 run -e EMAIL=you@x.com -e PASSWORD=... loadtest/k6.js # also exercises signed-in screens with ONE test account
//
// Every virtual user behaves like a player opening the app: the web page, the API health check, the community
// numbers, and (with a test account) the daily hub, a board, stats and a sync pull.
// Use a throwaway account, not a real player's. Run it off-peak: it will wake the free server and count against its hours.
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const API = __ENV.API || 'https://zenigma-api.ska97homelab.uk';
const WEB = __ENV.WEB || 'https://zenigma.ska97homelab.uk';
const EMAIL = __ENV.EMAIL;
const PASSWORD = __ENV.PASSWORD;

const profiles = {
  // About 5 players arriving at once, for 2 minutes: a sanity check.
  light: [{ duration: '30s', target: 5 }, { duration: '90s', target: 5 }, { duration: '15s', target: 0 }],
  // Ramp to 50 simultaneous players: roughly the evening peak of a few thousand daily users.
  heavy: [{ duration: '1m', target: 25 }, { duration: '3m', target: 50 }, { duration: '1m', target: 0 }],
};

export const options = {
  stages: profiles[__ENV.PROFILE || 'light'],
  thresholds: {
    // After the first (cold) request the API should answer quickly and almost never fail.
    http_req_failed: ['rate<0.02'],
    'http_req_duration{kind:api}': ['p(95)<800'],
    'http_req_duration{kind:web}': ['p(95)<1500'],
  },
};

export function setup() {
  // Wakes the free server (about a minute) before the clock starts, and signs in once for everyone.
  let tries = 0;
  while (tries++ < 12) {
    const r = http.get(`${API}/health`, { timeout: '30s' });
    if (r.status === 200) break;
    sleep(10);
  }
  if (!EMAIL || !PASSWORD) return { token: null };
  const login = http.post(`${API}/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (login.status !== 200) throw new Error(`Sign-in failed (${login.status}); check EMAIL and PASSWORD`);
  return { token: login.json('accessToken') };
}

export default function (data) {
  group('open the app', () => {
    const page = http.get(`${WEB}/`, { tags: { kind: 'web' } });
    check(page, { 'web 200': (r) => r.status === 200 });
    const health = http.get(`${API}/health`, { tags: { kind: 'api' } });
    check(health, { 'health 200': (r) => r.status === 200 });
    const community = http.get(`${API}/public/community`, { tags: { kind: 'api' } });
    check(community, { 'community 200': (r) => r.status === 200 });
  });

  if (data.token) {
    const auth = { headers: { Authorization: `Bearer ${data.token}` }, tags: { kind: 'api' } };
    group('signed-in screens', () => {
      check(http.get(`${API}/daily`, auth), { 'daily 200': (r) => r.status === 200 });
      const board = http.get(`${API}/leaderboards/word-guess?kind=daily&period=today`, auth);
      check(board, { 'board 200': (r) => r.status === 200 });
      // The same board again with its ETag: the answer should be a bodyless 304.
      const etag = board.headers['Etag'];
      if (etag) {
        const again = http.get(`${API}/leaderboards/word-guess?kind=daily&period=today`, {
          headers: { Authorization: `Bearer ${data.token}`, 'If-None-Match': etag }, tags: { kind: 'api' },
        });
        check(again, { 'board 304': (r) => r.status === 304 });
      }
      check(http.get(`${API}/stats`, auth), { 'stats 200': (r) => r.status === 200 });
      check(http.get(`${API}/sync/pull?after=0&limit=50`, auth), { 'pull 200': (r) => r.status === 200 });
    });
  }

  sleep(2 + Math.random() * 4); // a player reads the screen before the next tap
}
