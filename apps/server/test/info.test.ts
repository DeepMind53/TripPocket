import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { resetWikiCache, shortExtract } from '../src/services/wikiSummary';

/** 여행지 소개 (docs/26 A4, 2026-11-03) */
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET });

let db: Db;
let app: FastifyInstance;
let sid: string;
let urls: string[];
let reply: () => Response;

beforeEach(async () => {
  resetWikiCache();
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', '홍길동', 'x')").run();
  sid = createSession(db, 'u1', 't');
  urls = [];
  reply = () =>
    Response.json({
      type: 'standard',
      title: '도쿄',
      extract: '도쿄(東京)는 일본의 수도이다. 인구가 가장 많다. 세 번째 문장이다.',
      content_urls: { mobile: { page: 'https://ko.m.wikipedia.org/wiki/도쿄' } },
    });
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(String(url));
    return reply();
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const get = (title: string, cookie = true) =>
  app.inject({
    method: 'GET',
    url: `/api/info/summary?title=${encodeURIComponent(title)}`,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(cookie ? { cookie: `__Host-sid=${sid}` } : {}),
    },
  });

it('로그인해야 하고, 도시 이름만 보내고, 두 문장만 돌려주고, 같은 이름은 다시 묻지 않는다', async () => {
  expect((await get('도쿄', false)).statusCode).toBe(401);
  const res = await get('도쿄');
  expect(res.json()).toEqual({
    summary: {
      title: '도쿄',
      extract: '도쿄는 일본의 수도이다. 인구가 가장 많다.',
      url: 'https://ko.m.wikipedia.org/wiki/도쿄',
    },
  });
  await get('도쿄');
  expect(urls).toHaveLength(1);
  expect(urls[0]).toMatch(/^https:\/\/ko\.wikipedia\.org\/api\/rest_v1\/page\/summary\//);
  expect(urls.join()).not.toMatch(/홍길동|u1/);
});

it('없는 문서·동음이의어는 null, 위키백과 오류는 503', async () => {
  reply = () => new Response('', { status: 404 });
  expect((await get('없는도시')).json()).toEqual({ summary: null });
  reply = () => Response.json({ type: 'disambiguation', title: '광주', extract: '광주는…' });
  expect((await get('광주')).json()).toEqual({ summary: null });
  reply = () => new Response('', { status: 500 });
  expect((await get('부산')).statusCode).toBe(503);
  expect((await get('')).statusCode).toBe(400);
});

it('요약 줄이기: 괄호 빼고 두 문장, 200자까지', () => {
  expect(shortExtract('타이베이(臺北)는 수도다. 둘. 셋.')).toBe('타이베이는 수도다. 둘.');
  expect(shortExtract('가'.repeat(300))).toHaveLength(200);
});
