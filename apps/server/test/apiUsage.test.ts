import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  GOOGLE_PLACES_KEY: 'gp',
});

let db: Db;
let app: FastifyInstance;
let admin: string;
let member: string;
let googleCalls: number;

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare(
    "INSERT INTO users (id, nickname, created_at, is_admin) VALUES ('a', '관리자', '1', 1), ('m', '멤버', '2', 0)",
  ).run();
  admin = createSession(db, 'a', 't');
  member = createSession(db, 'm', 't');
  googleCalls = 0;
  vi.stubGlobal('fetch', async (input: string | URL) => {
    if (String(input).includes('places.googleapis.com')) {
      googleCalls++;
      return Response.json({
        places: [{ id: 'g1', displayName: { text: 'Tokyo Tower' }, formattedAddress: 'Tokyo' }],
      });
    }
    return new Response('', { status: 404 });
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const req = (method: 'GET' | 'POST', url: string, sid?: string, payload?: object) =>
  app.inject({
    method,
    url,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(sid ? { cookie: `__Host-sid=${sid}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });
const search = (q: string) => req('POST', '/api/places/search', member, { q, scope: 'overseas' });
type Report = {
  month: string;
  apis: {
    id: string;
    group: string;
    used: number;
    today: number;
    freeMonthly: number | null;
    autoLimit: number | null;
    paused: boolean;
    autoStopped: boolean;
  }[];
};
const report = async () => (await req('GET', '/api/admin/api-usage', admin)).json() as Report;
const api = (r: Report, id: string) => r.apis.find((a) => a.id === id)!;

describe('API 사용량 (관리자)', () => {
  it('호출을 날짜별로 세어 이번 달 누적, 과금 가능/무료로 나눠 보여 준다', async () => {
    await search('tokyo tower');
    await search('osaka castle');
    const r = await report();
    const g = api(r, 'google_places_search');
    expect(g).toMatchObject({
      group: 'paid',
      used: 2,
      today: 2,
      freeMonthly: 5000,
      autoLimit: 4500,
    });
    expect(api(r, 'gemini').group).toBe('free');
    expect(r.month).toBe(new Date().toISOString().slice(0, 7));
  });

  it('수동 중지하면 부르지 않고, 다시 켜면 부른다', async () => {
    await req('POST', '/api/admin/api-usage/google_places_search', admin, { paused: true });
    await search('tokyo tower');
    expect(googleCalls).toBe(0);
    expect(api(await report(), 'google_places_search').paused).toBe(true);
    await req('POST', '/api/admin/api-usage/google_places_search', admin, { paused: false });
    await search('kyoto');
    expect(googleCalls).toBe(1);
  });

  it('이번 달 자동 상한에 닿으면 자동 중지 (상한은 관리자가 바꿀 수 있음)', async () => {
    await req('POST', '/api/admin/api-usage/google_places_details', admin, { limit: 1 });
    expect((await req('GET', '/api/places/google/ChIJ0000000000', member)).statusCode).not.toBe(
      503,
    );
    const blocked = await req('GET', '/api/places/google/ChIJ1111111111', member);
    expect(blocked.statusCode).toBe(503);
    expect(blocked.json()).toEqual({ error: 'api_paused' });
    expect(api(await report(), 'google_places_details').autoStopped).toBe(true);
  });

  it('지도 로드는 공개 기록, 멈추면 flags.maps = false', async () => {
    expect((await req('POST', '/api/usage/map-load')).statusCode).toBe(200);
    expect(api(await report(), 'google_maps_js').used).toBe(1);
    await req('POST', '/api/admin/api-usage/google_maps_js', admin, { paused: true });
    expect((await req('GET', '/api/usage/flags')).json()).toEqual({ maps: false });
  });

  it('관리자만: 멤버 403, 로그인 안 하면 401, 없는 API 404, 잘못된 값 400', async () => {
    expect((await req('GET', '/api/admin/api-usage', member)).statusCode).toBe(403);
    expect((await req('GET', '/api/admin/api-usage')).statusCode).toBe(401);
    expect(
      (await req('POST', '/api/admin/api-usage/nope', admin, { paused: true })).statusCode,
    ).toBe(404);
    expect((await req('POST', '/api/admin/api-usage/groq', admin, { limit: -1 })).statusCode).toBe(
      400,
    );
  });
});
