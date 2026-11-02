import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { resetLlmCooldown } from '../src/services/llm';

/** 직접 입력한 음식·약 이름 번역 (사용자 결정 2026-11-02) */
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  GROQ_API_KEY: 'g',
});

let db: Db;
let app: FastifyInstance;
let sid: string;
let sent: string[];
let reply: () => Response;

beforeEach(async () => {
  resetLlmCooldown();
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', '홍길동', 'x')").run();
  sid = createSession(db, 'u1', 't');
  sent = [];
  reply = () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [{ id: 't0', tr: { ja: 'パクチー', en: 'coriander', xx: '무시' } }],
            }),
          },
        },
      ],
    });
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    sent.push(String(init?.body));
    return reply();
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
    url: '/api/translate/terms',
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(cookie ? { cookie: `__Host-sid=${sid}` } : {}),
    },
    payload: body,
  });

it('로그인해야 하고, 이름만 보내고, 모르는 언어는 버린다', async () => {
  const body = { terms: [{ id: 't0', ko: '고수', en: 'coriander' }] };
  expect((await post(body, false)).statusCode).toBe(401);
  const res = await post(body);
  expect(res.json()).toEqual({ translations: { t0: { ja: 'パクチー', en: 'coriander' } } });
  expect(sent.join()).not.toMatch(/홍길동|u1/);
});

it('AI가 모두 실패하면 503 (앱이 번역기 바로가기로)', async () => {
  reply = () => Response.json({ choices: [{ message: { content: 'oops' } }] });
  expect((await post({ terms: [{ id: 't0', ko: '고수', en: '' }] })).statusCode).toBe(503);
});
