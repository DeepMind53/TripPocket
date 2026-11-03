import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { resetStationCache } from '../src/services/stations';

/** 해외 역·터미널 찾기 (예약 기차·버스, 2026-11-03) */
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  GEOAPIFY_KEY: 'geokey',
});

let db: Db;
let app: FastifyInstance;
let sid: string;
let urls: string[];

beforeEach(async () => {
  resetStationCache();
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', '홍길동', 'x')").run();
  sid = createSession(db, 'u1', 't');
  urls = [];
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/v1/geocode/search'))
      return Response.json({ results: [{ lat: 34.7, lon: 135.5 }] });
    return Response.json({
      features: [
        {
          properties: {
            name: '신오사카역',
            name_international: { en: 'Shin-Osaka' },
            address_line2: '오사카 요도가와구',
            lat: 34.73,
            lon: 135.5,
          },
        },
        // 같은 역 승강장이 또 와도 하나만
        { properties: { name: '신오사카역', lat: 34.731, lon: 135.501 } },
        { properties: { name: '오사카역', lat: 34.7, lon: 135.49 } },
        { properties: { lat: 1, lon: 1 } },
      ],
    });
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const post = (body: object, cookie = true) =>
  app.inject({
    method: 'POST',
    url: '/api/places/stations',
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(cookie ? { cookie: `__Host-sid=${sid}` } : {}),
    },
    payload: body,
  });

it('로그인 필요 · 도시 이름 → 그 도시 기차역 (이름 하나씩), 같은 도시는 다시 묻지 않는다', async () => {
  expect((await post({ city: '오사카', cc: 'JP', kind: 'train' }, false)).statusCode).toBe(401);
  const res = await post({ city: '오사카', cc: 'JP', kind: 'train' });
  expect(res.json().stations).toEqual([
    {
      name: '신오사카역',
      local: 'Shin-Osaka',
      address: '오사카 요도가와구',
      coords: { lat: 34.73, lng: 135.5 },
    },
    { name: '오사카역', address: '', coords: { lat: 34.7, lng: 135.49 } },
  ]);
  expect(urls[0]).toContain('type=city');
  expect(urls[0]).toContain('countrycode%3Ajp');
  expect(urls[1]).toContain('categories=public_transport.train');
  await post({ city: '오사카', cc: 'JP', kind: 'train' });
  expect(urls).toHaveLength(2);
  expect(urls.join()).not.toMatch(/홍길동|u1/);
});

it('도시 없이 여행지 좌표로도 · 좌표는 주소에 남지 않게 본문으로만 · 잘못된 요청은 400', async () => {
  const res = await post({ near: { lat: 34.7, lng: 135.5 }, kind: 'bus' });
  expect(res.statusCode).toBe(200);
  expect(urls[0]).toContain('categories=public_transport.bus');
  expect((await post({ kind: 'train' })).statusCode).toBe(400);
  expect((await post({ city: '오사카', kind: 'plane' })).statusCode).toBe(400);
});
