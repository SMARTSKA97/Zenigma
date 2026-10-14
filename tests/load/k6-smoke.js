// A gentle load test for the API. Run it against a TEST copy, never with real players on it:
//   k6 run -e BASE=https://zenigma-api.ska97homelab.uk tests/load/k6-smoke.js
// Each virtual user signs up once, then pushes sync events and reads boards the way the app does.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: { http_req_failed: ['rate<0.02'], http_req_duration: ['p(95)<1500'] },
};

export function setup() {
  return {};
}

export default function () {
  const device = uuidv4();
  const email = `load-${uuidv4()}@example.com`;
  const json = { headers: { 'Content-Type': 'application/json' } };
  const reg = http.post(`${BASE}/auth/register`, JSON.stringify({ email, password: 'load-test-pass-1', displayName: 'Load', deviceId: device }), json);
  if (!check(reg, { registered: (r) => r.status === 200 })) return;
  const auth = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reg.json('accessToken')}` } };

  for (let i = 0; i < 5; i++) {
    const events = Array.from({ length: 20 }, () => ({ id: uuidv4(), kind: 'mind.daily.completed', payload: { date: '2026-10-14', points: 120 }, clientCreatedAt: new Date().toISOString() }));
    check(http.post(`${BASE}/sync/push`, JSON.stringify({ deviceId: device, platform: 'web', events }), auth), { pushed: (r) => r.status === 200 });
    check(http.get(`${BASE}/leaderboards/mind-daily?period=today`, auth), { board: (r) => r.status === 200 });
    check(http.get(`${BASE}/leaderboards/queens?kind=practice&period=week`, auth), { board2: (r) => r.status === 200 });
    check(http.get(`${BASE}/sync/pull?after=0`, auth), { pulled: (r) => r.status === 200 });
    sleep(1);
  }
}
