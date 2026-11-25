import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { staticMapUrl } from '../src/services/staticMap';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  GOOGLE_PLACES_KEY: 'gk',
});
let db: Db;
let app: FastifyInstance;
let sid: string;
let urls: string[];

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', 'n', 'x')").run();
  sid = createSession(db, 'u1', 't');
  urls = [];
  vi.stubGlobal('fetch', async (input: string | URL) => {
    urls.push(String(input));
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { 'content-type': 'image/png' },
    });
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const get = (q: string, cookie: string | null = `__Host-sid=${sid}`) =>
  app.inject({
    method: 'GET',
    url: `/api/maps/static?${q}`,
    headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, ...(cookie ? { cookie } : {}) },
  });

describe('일정표 상세 출력의 일차 지도 (2026-11-25)', () => {
  it('번호 핀 1~9는 숫자, 10번부터는 글자 없이 · 둘 이상이면 순서선', () => {
    const u = staticMapUrl(
      [
        { lat: 35.1, lng: 139.1, n: 1 },
        { lat: 35.2, lng: 139.2, n: 12 },
      ],
      '2F6BFF',
    );
    const markers = u.searchParams.getAll('markers');
    expect(markers[0]).toBe('color:0x2F6BFF|label:1|35.100000,139.100000');
    expect(markers[1]).toBe('color:0x2F6BFF|35.200000,139.200000');
    expect(u.searchParams.get('path')).toContain('35.100000,139.100000|35.200000,139.200000');
    expect(u.searchParams.get('key')).toBeNull();
  });

  it('로그인 필요, 이상한 값 400, 그림은 그대로 넘기고 기기에만 하루 보관', async () => {
    expect((await get('p=35.1,139.1,1', null)).statusCode).toBe(401);
    expect((await get('p=abc')).statusCode).toBe(400);
    expect((await get('p=95,139.1,1')).statusCode).toBe(400);
    const res = await get('p=35.1,139.1,1;35.2,139.2,3&c=ff6b4a');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('private, max-age=86400');
    expect(urls).toHaveLength(1);
    const sent = new URL(urls[0]!);
    expect(sent.searchParams.get('key')).toBe('gk');
    expect(sent.searchParams.getAll('markers')[1]).toContain('label:3');
  });
});
