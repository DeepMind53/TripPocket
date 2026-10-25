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
  KAKAO_CLIENT_ID: 'kakao',
  NAVER_CLIENT_ID: 'nid',
  NAVER_CLIENT_SECRET: 'nsec',
  GOOGLE_PLACES_KEY: 'gkey',
});

let db: Db;
let app: FastifyInstance;
let sid: string;
let calls: { url: string; headers: Record<string, string>; body: string }[];

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', 'n', 'x')").run();
  sid = createSession(db, 'u1', 't');
  calls = [];
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: String(init?.body ?? ''),
    });
    if (url.includes('dapi.kakao.com'))
      return Response.json({
        documents: [
          {
            id: '1',
            place_name: '성수 카페 어니언',
            address_name: '서울 성동구',
            road_address_name: '서울 성동구 아차산로 9길 8',
            x: '127.05',
            y: '37.54',
            category_name: '음식점 > 카페',
            place_url: 'https://place.map.kakao.com/1',
          },
        ],
      });
    if (url.includes('openapi.naver.com'))
      return Response.json({
        items: [
          {
            title: '<b>어니언</b> 성수',
            roadAddress: '서울 성동구 아차산로9길 8',
            mapx: '1270500000',
            mapy: '375400000',
            category: '카페>디저트',
          },
        ],
      });
    if (url.includes('places:searchText'))
      return Response.json({
        places: [
          {
            id: 'ChIJ_onion_tokyo',
            displayName: { text: '어니언 도쿄' },
            formattedAddress: '도쿄',
            location: { latitude: 35.6, longitude: 139.7 },
          },
        ],
      });
    if (url.includes('places.googleapis.com/v1/places/'))
      return Response.json({
        rating: 4.4,
        userRatingCount: 1234,
        regularOpeningHours: {
          weekdayDescriptions: ['월요일: 오전 10:00~오후 10:00'],
          periods: [
            { open: { day: 1, hour: 10, minute: 0 }, close: { day: 1, hour: 22, minute: 0 } },
          ],
        },
        currentOpeningHours: { openNow: true },
      });
    return new Response('', { status: 404 });
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const search = (body: object, cookie = `__Host-sid=${sid}`) =>
  app.inject({
    method: 'POST',
    url: '/api/places/search',
    headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, cookie },
    payload: body,
  });

describe('장소 검색', () => {
  it('국내: 카카오·네이버를 합쳐 비슷한 순, Google은 부르지 않는다', async () => {
    const res = (await search({ q: '어니언', scope: 'domestic' })).json();
    expect(
      res.places.map((p: { source: string; name: string }) => `${p.source}:${p.name}`),
    ).toEqual(['naver:어니언 성수', 'kakao:성수 카페 어니언']);
    expect(res.places[0].coords).toEqual({ lat: 37.54, lng: 127.05 });
    expect(calls.some((c) => c.url.includes('googleapis'))).toBe(false);
  });

  it('해외: Google — 비싼 필드를 부르지 않도록 FieldMask 고정, 같은 검색은 캐시', async () => {
    const res = (
      await search({ q: '어니언', scope: 'overseas', near: { lat: 35.68, lng: 139.69 } })
    ).json();
    expect(res.places[0]).toMatchObject({ source: 'google', id: 'ChIJ_onion_tokyo' });
    const g = calls.find((c) => c.url.includes('searchText'))!;
    expect(g.headers['X-Goog-FieldMask']).toBe(
      'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri',
    );
    expect(g.headers['X-Goog-FieldMask']).not.toMatch(/rating|reviews|OpeningHours/);
    await search({ q: '어니언', scope: 'overseas', near: { lat: 35.68, lng: 139.69 } });
    expect(calls.filter((c) => c.url.includes('searchText'))).toHaveLength(1);
  });

  it('Google 검색은 하루 한도 없이, 월 무료량 90%에서 자동 중지 → 이유(api_paused)를 알려 준다 (2026-10-26)', async () => {
    for (const q of ['a1', 'a2', 'a3', 'a4']) await search({ q, scope: 'overseas' });
    expect(calls.filter((c) => c.url.includes('searchText'))).toHaveLength(4);
    // 이번 달 4,500회(무료 5,000의 90%)를 쓴 상태
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(
      new Date(),
    );
    db.prepare(
      "INSERT INTO api_usage (api, date, count) VALUES ('google_places_search', ?, 4500) ON CONFLICT (api, date) DO UPDATE SET count = 4500",
    ).run(month);
    const res = await search({ q: 'b1', scope: 'overseas' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'api_paused', api: 'google_places_search' });
    expect(calls.filter((c) => c.url.includes('searchText'))).toHaveLength(4);
  });

  it('평점·영업시간은 고른 장소를 볼 때만, 로그인 필요', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/places/google/ChIJ_onion_tokyo',
      headers: { [PROXY_HEADER]: SECRET, cookie: `__Host-sid=${sid}` },
    });
    expect(res.json()).toMatchObject({
      rating: 4.4,
      userRatingCount: 1234,
      openNow: true,
      periods: [{ day: 1, open: '10:00', close: '22:00' }],
    });
    expect(res.headers['cache-control']).toBe('no-store');
    expect((await search({ q: 'x', scope: 'domestic' }, '')).statusCode).toBe(401);
  });
});
