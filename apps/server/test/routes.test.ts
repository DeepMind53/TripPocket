import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { clearRouteCache } from '../src/services/routes';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  KAKAO_CLIENT_ID: 'kakao',
  GOOGLE_PLACES_KEY: 'gkey',
  GEOAPIFY_KEY: 'geokey',
});

let db: Db;
let app: FastifyInstance;
let sid: string;
let calls: { url: string; body: string; headers: Record<string, string> }[];

const from = { lat: 35.6895, lng: 139.6917 };
const to = { lat: 35.7148, lng: 139.7967 };

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', 'n', 'x')").run();
  sid = createSession(db, 'u1', 't');
  clearRouteCache();
  calls = [];
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const body = String(init?.body ?? '');
    calls.push({ url, body, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.includes('routes.googleapis.com'))
      return Response.json({
        routes: [{ duration: body.includes('TRANSIT') ? '1500s' : '3600s' }],
      });
    if (url.includes('api.geoapify.com/v1/routing'))
      return Response.json({
        features: [{ properties: { time: url.includes('mode=walk') ? 3000 : 1800 } }],
      });
    return new Response('not found', { status: 404 });
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const eta = (payload: object, cookie: string | null = `__Host-sid=${sid}`) =>
  app.inject({
    method: 'POST',
    url: '/api/routes/eta',
    headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    payload,
  });

function used(api: string, n: number, tz: string) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  db.prepare(
    'INSERT INTO api_usage (api, date, count) VALUES (?, ?, ?) ON CONFLICT (api, date) DO UPDATE SET count = excluded.count',
  ).run(api, day, n);
}

describe('출발 시각 (두 장소 소요 시간)', () => {
  it('로그인해야 쓴다, 본문이 틀리면 400', async () => {
    expect((await eta({ from, to, google: false }, null)).statusCode).toBe(401);
    expect((await eta({ from, google: false })).statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('Google Routes가 멈추면 Google 좌표가 아닐 때만 무료 Geoapify: 걷기 + 대중교통 어림', async () => {
    used('google_routes', 9500, 'America/Los_Angeles');
    const res = await eta({ from, to, google: false });
    expect(res.json()).toEqual({ walk: 50, transit: 30, source: 'osm' });
    expect(calls.map((c) => new URL(c.url).searchParams.get('mode'))).toEqual([
      'walk',
      'approximated_transit',
    ]);
    // 같은 두 곳은 다시 부르지 않는다
    await eta({ from, to, google: false });
    expect(calls).toHaveLength(2);
  });

  it('실제 길 시간은 Google Routes가 먼저 — 걷기·대중교통 둘 다 (시간 필드만 요청)', async () => {
    const plain = await eta({ from, to, google: false });
    expect(plain.json()).toEqual({ walk: 60, transit: 25, source: 'google' });
    clearRouteCache();
    calls.length = 0;
    const res = await eta({ from, to, google: true });
    expect(res.json()).toEqual({ walk: 60, transit: 25, source: 'google' });
    expect(calls.every((c) => c.url.includes('routes.googleapis.com'))).toBe(true);
    expect(calls[0]!.headers['X-Goog-FieldMask']).toBe('routes.duration');
    expect(calls.map((c) => JSON.parse(c.body).travelMode)).toEqual(['WALK', 'TRANSIT']);
  });

  it('Google 무료량이 끝나면 Google 좌표는 503 (다른 회사로 보내지 않음)', async () => {
    used('google_routes', 9500, 'America/Los_Angeles');
    const res = await eta({ from, to, google: true });
    expect(res.statusCode).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it('Google이 실패(키 제한 403 등)하면 Google 좌표가 아닐 때 Geoapify로, Google 좌표면 503', async () => {
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: String(init?.body ?? ''), headers: {} });
      if (url.includes('routes.googleapis.com')) return new Response('blocked', { status: 403 });
      return Response.json({ features: [{ properties: { time: 1800 } }] });
    });
    expect((await eta({ from, to, google: false })).json().source).toBe('osm');
    clearRouteCache();
    expect((await eta({ from, to, google: true })).statusCode).toBe(503);
  });

  it('내 위치에서 출발(live)이면 서버 메모리에도 남기지 않는다 — 같은 요청도 다시 묻는다', async () => {
    await eta({ from, to, google: false, live: true });
    await eta({ from, to, google: false, live: true });
    // Google 걷기·대중교통 2건씩
    expect(calls).toHaveLength(4);
  });
});
