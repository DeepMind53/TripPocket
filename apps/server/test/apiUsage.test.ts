import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { dailyQuota, MAP_LOADS_PER_IP_DAY } from '../src/routes/usage';
import { apiAllowed, APIS, guardApi, trackApi } from '../src/services/apiUsage';

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
      autoLimit: 4750,
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
    // 멈추면 Google 대신 트립포켓 후기 별점 + Google 지도 링크 (docs/23 §2)
    expect(blocked.statusCode).toBe(200);
    expect(blocked.json()).toMatchObject({ source: 'trippocket' });
    expect(api(await report(), 'google_places_details').autoStopped).toBe(true);
  });

  it('로그인 안 하면 지도 허용·기록 모두 401 (외부인이 지도 키를 쓰지 못하게)', async () => {
    expect((await req('GET', '/api/usage/flags')).statusCode).toBe(401);
    expect((await req('POST', '/api/usage/map-load')).statusCode).toBe(401);
  });

  it('지도 로드 기록, 멈추면 flags.maps = false', async () => {
    expect((await req('POST', '/api/usage/map-load', member)).statusCode).toBe(200);
    expect(api(await report(), 'google_maps_js').used).toBe(1);
    await req('POST', '/api/admin/api-usage/google_maps_js', admin, { paused: true });
    expect((await req('GET', '/api/usage/flags', member)).json()).toMatchObject({
      maps: false,
      naverMaps: true,
    });
  });

  it('네이버 지도 로드는 따로 기록·중지', async () => {
    await req('POST', '/api/usage/map-load', member, { provider: 'naver' });
    const r = await report();
    expect(api(r, 'naver_maps_js').used).toBe(1);
    expect(api(r, 'google_maps_js').used).toBe(0);
    await req('POST', '/api/admin/api-usage/naver_maps_js', admin, { paused: true });
    expect((await req('GET', '/api/usage/flags', member)).json()).toMatchObject({
      maps: true,
      naverMaps: false,
    });
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

describe('dailyQuota (지도 로드 부풀리기 방지)', () => {
  it('키마다 하루 한도까지만, 날짜가 바뀌면 다시', () => {
    let now = new Date('2026-10-24T10:00:00Z');
    const q = dailyQuota(2, () => now);
    expect([q.hit('a'), q.hit('a'), q.hit('a'), q.hit('b')]).toEqual([true, true, false, true]);
    expect([q.left('a'), q.left('b')]).toEqual([false, true]);
    now = new Date('2026-10-25T00:00:01Z');
    expect(q.left('a')).toBe(true);
    expect(q.hit('a')).toBe(true);
  });

  it('유료 지도는 한 사람 하루 100번을 넘어도 늘 센다 — 대신 그 사람에게는 막는다 (2026-11-12)', async () => {
    // 분당 30번 요청 제한은 주소마다라, 시험에서는 요청마다 다른 주소로
    for (let i = 0; i < MAP_LOADS_PER_IP_DAY + 2; i++)
      await app.inject({
        method: 'POST',
        url: '/api/usage/map-load',
        remoteAddress: `10.0.${i >> 8}.${i & 255}`,
        headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, cookie: `__Host-sid=${member}` },
        payload: { api: 'google_maps_js' },
      });
    expect(api(await report(), 'google_maps_js').used).toBe(MAP_LOADS_PER_IP_DAY + 2);
    const flags = (await req('GET', '/api/usage/flags', member)).json() as {
      apis: Record<string, boolean>;
    };
    // 이 사람은 무료 지도로, 무료 브라우저 API는 그대로
    expect(flags.apis).toMatchObject({
      google_maps_js: false,
      openfreemap: true,
      open_meteo: true,
    });
  });
});

describe('API 사용량 — 모든 외부 API·하루 한도·중지 불가 항목', () => {
  it('하루 무료량이 있는 API는 오늘 95%에서 자동 중지, 관리자가 하루 상한을 바꿀 수 있다', async () => {
    trackApi('kakao_keyword', 94_999);
    expect(apiAllowed('kakao_keyword')).toBe(true);
    trackApi('kakao_keyword');
    expect(apiAllowed('kakao_keyword')).toBe(false);
    expect(() => guardApi('kakao_keyword')).toThrow('api_paused');
    const k = api(await report(), 'kakao_keyword') as unknown as { autoStoppedBy: string };
    expect(k.autoStoppedBy).toBe('day');
    await req('POST', '/api/admin/api-usage/kakao_keyword', admin, { dailyLimit: 98_000 });
    expect(apiAllowed('kakao_keyword')).toBe(true);
  });

  it('카카오: API별 하루 쿼터 + 카카오맵 전체 월 합산(300만) — 합산을 멈추면 둘 다 멈춘다', async () => {
    trackApi('kakao_keyword', 3);
    trackApi('kakao_category', 2);
    const r = await report();
    expect(api(r, 'kakao_map').used).toBe(5);
    expect(api(r, 'kakao_map').freeMonthly).toBe(3_000_000);
    expect(api(r, 'kakao_category').used).toBe(2);
    await req('POST', '/api/admin/api-usage/kakao_map', admin, { limit: 5 });
    expect(apiAllowed('kakao_keyword')).toBe(false);
    expect(apiAllowed('kakao_category')).toBe(false);
    await req('POST', '/api/admin/api-usage/kakao_map', admin, { limit: null });
    await req('POST', '/api/admin/api-usage/kakao_map', admin, { paused: true });
    expect(apiAllowed('kakao_category')).toBe(false);
  });

  it('브라우저 API(날씨 등)도 기록·중지, 모르는 id는 무시', async () => {
    await req('POST', '/api/usage/map-load', member, { api: 'open_meteo' });
    await req('POST', '/api/usage/map-load', member, { api: 'gemini' });
    const r = await report();
    expect(api(r, 'open_meteo').used).toBe(1);
    expect(api(r, 'gemini').used).toBe(0);
    await req('POST', '/api/admin/api-usage/open_meteo', admin, { paused: true });
    const flags = (await req('GET', '/api/usage/flags', member)).json() as {
      apis: Record<string, boolean>;
    };
    expect(flags.apis).toMatchObject({ open_meteo: false, nager_date: true, google_maps_js: true });
    // 서버 전용 API는 브라우저에 알려 주지 않는다
    expect(flags.apis).not.toHaveProperty('gemini');
  });

  it('로그인·프록시는 기록만 (수동 중지 400), 프록시를 거친 요청은 Pages 함수 사용량으로 센다', async () => {
    expect(
      (await req('POST', '/api/admin/api-usage/oauth_kakao', admin, { paused: true })).statusCode,
    ).toBe(400);
    await req('GET', '/api/usage/flags', member);
    expect(api(await report(), 'cf_functions').used).toBeGreaterThan(0);
  });

  it('외부 호출 코드가 쓰는 id는 모두 APIS에 등록돼 있다', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const ids = new Set(APIS.map((a) => a.id));
    const used = new Set<string>();
    for (const dir of ['src/services', 'src/routes']) {
      for (const f of readdirSync(dir)) {
        const src = readFileSync(`${dir}/${f}`, 'utf8');
        for (const m of src.matchAll(/(?:guardApi|trackApi)\('([\w-]+)'/g)) used.add(m[1]!);
      }
    }
    expect([...used].filter((id) => !ids.has(id as never))).toEqual([]);
  });

  it('서버의 외부 호출(fetch)마다 바로 앞에서 guardApi·trackApi를 거친다 (빠뜨리면 사용량이 안 세진다)', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const missing: string[] = [];
    for (const dir of ['src/services', 'src/routes']) {
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
        const lines = readFileSync(`${dir}/${f}`, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (!/\bfetch\(/.test(line)) return;
          const before = lines.slice(Math.max(0, i - 25), i + 1).join('\n');
          if (!/guardApi\(|trackApi\(/.test(before)) missing.push(`${dir}/${f}:${i + 1}`);
        });
      }
    }
    expect(missing).toEqual([]);
  });

  it('웹이 브라우저에서 바로 부르는 API 목록 = 서버 APIS의 browser 항목 (한쪽만 고치면 기록이 버려진다)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('../web/src/data/api/usage.ts', 'utf8');
    const union = src.slice(
      src.indexOf('export type BrowserApi'),
      src.indexOf(';', src.indexOf('export type BrowserApi')),
    );
    const web = [...union.matchAll(/'([\w-]+)'/g)].map((m) => m[1]).sort();
    const server = APIS.filter((a) => a.browser)
      .map((a) => a.id)
      .sort();
    expect(web).toEqual(server);
  });
});
