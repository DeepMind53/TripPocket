import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { resetFlightCache } from '../src/services/flights';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
let db: Db;
let app: FastifyInstance;
let sid: string;
let urls: string[];

beforeEach(async () => {
  resetFlightCache();
  db = openDb(':memory:');
  app = await buildApp(
    loadConfig({
      NODE_ENV: 'test',
      WEB_ORIGIN: ORIGIN,
      PROXY_SECRET: SECRET,
      AVIATIONSTACK_KEY: 'k',
    }),
    db,
  );
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u', 'u', 'x')").run();
  sid = createSession(db, 'u', 't');
  urls = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    // 무료 요금제: HTTPS 막힘 → HTTP로 다시
    if (url.startsWith('https:'))
      return Response.json({ error: { code: 'https_access_restricted' } });
    return Response.json({
      data: [
        {
          flight_date: '2026-10-23',
          airline: { name: 'Korean Air' },
          departure: { iata: 'ICN', terminal: '2', scheduled: '2026-10-23T09:00:00+00:00' },
          arrival: { iata: 'NRT', terminal: '1', scheduled: '2026-10-23T11:20:00+00:00' },
        },
        {
          flight_date: '2026-10-24',
          airline: { name: 'Korean Air' },
          departure: { iata: 'ICN', terminal: '2', scheduled: '2026-10-24T09:10:00+00:00' },
          arrival: { iata: 'NRT', terminal: '1', scheduled: '2026-10-24T11:30:00+00:00' },
        },
      ],
    });
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const get = (no: string, auth = true) =>
  app.inject({
    method: 'GET',
    url: `/api/flights/${no}`,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(auth ? { cookie: `__Host-sid=${sid}` } : {}),
    },
  });

describe('편명으로 항공편 불러오기 (AviationStack 무료)', () => {
  it('가장 최근 운항의 공항·터미널·현지 시각, HTTPS가 막히면 HTTP로, 같은 편명은 저장본', async () => {
    const res = await get('ke 703');
    expect(res.json()).toEqual({
      flightNo: 'KE703',
      airline: 'Korean Air',
      from: { iata: 'ICN', terminal: '2', time: '09:10' },
      to: { iata: 'NRT', terminal: '1', time: '11:30' },
    });
    expect(urls.map((u) => u.split(':')[0])).toEqual(['https', 'http']);
    await get('KE703');
    expect(urls).toHaveLength(2); // 저장본 — 다시 부르지 않음
    const usage = db
      .prepare("SELECT SUM(count) n FROM api_usage WHERE api = 'aviationstack'")
      .get() as { n: number };
    expect(usage.n).toBe(2);
  });

  it('로그인 필요, 이상한 편명은 400', async () => {
    expect((await get('KE703', false)).statusCode).toBe(401);
    expect((await get('hello')).statusCode).toBe(400);
  });
});

it('API 사용량: 하루 제한 없이 무료 월 100회 — 이번 달 90회에서 자동 중지 → 503 api_paused', async () => {
  // 하루에 9회 써도 막히지 않는다
  db.prepare("INSERT INTO api_usage (api, date, count) VALUES ('aviationstack', ?, 9)").run(
    new Date().toISOString().slice(0, 10),
  );
  expect((await get('KE703')).statusCode).toBe(200);
  // 이번 달 합계 90회면 멈춤
  db.prepare("UPDATE api_usage SET count = 90 WHERE api = 'aviationstack'").run();
  const res = await get('OZ101');
  expect(res.statusCode).toBe(503);
  expect(res.json()).toEqual({ error: 'api_paused', api: 'aviationstack' });
  expect(urls).toHaveLength(2); // 앞의 KE703 조회만
});
