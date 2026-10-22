import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { loadConfig, type Config } from '../src/config';
import { migrate, openDb, type Db } from '../src/db/database';

export const SECRET = 's'.repeat(40);
export const ORIGIN = 'https://trippocket.pages.dev';
export const testConfig: Config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
});

let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(testConfig, db);
  // 시험용 경로: 본문 크기·Origin 검사 확인
  app.post('/api/echo', async (req) => ({ size: JSON.stringify(req.body).length }));
  app.get('/api/boom', async () => {
    throw new Error('SELECT * FROM secret_table');
  });
});

afterEach(async () => {
  await app.close();
  db.close();
});

const proxied = { [PROXY_HEADER]: SECRET };

describe('설정', () => {
  it('필수 값이 없거나 틀리면 시작하지 않고, 비밀 값은 메시지에 넣지 않는다', () => {
    expect(() => loadConfig({ WEB_ORIGIN: ORIGIN, PROXY_SECRET: 'short-secret' })).toThrow(
      /PROXY_SECRET/,
    );
    expect(() => loadConfig({ PROXY_SECRET: SECRET })).toThrow(/WEB_ORIGIN/);
    try {
      loadConfig({ WEB_ORIGIN: ORIGIN, PROXY_SECRET: 'short-secret' });
    } catch (e) {
      expect(String(e)).not.toContain('short-secret');
    }
    expect(testConfig).toMatchObject({ HOST: '127.0.0.1', PORT: 8787 });
  });
});

describe('서버 기본', () => {
  it('/healthz는 프록시 없이도 응답하고 보안 헤더가 붙는다', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('프록시 비밀 헤더 없이 직접 들어오면 404 (있는지도 알려 주지 않음)', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/boom' })).statusCode).toBe(404);
    const wrong = { [PROXY_HEADER]: 'x'.repeat(40) };
    expect((await app.inject({ method: 'GET', url: '/api/boom', headers: wrong })).statusCode).toBe(
      404,
    );
  });

  it('상태를 바꾸는 요청은 웹앱 주소(Origin)에서 온 것만', async () => {
    const body = { a: 1 };
    const bad = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...proxied, origin: 'https://evil.example' },
      payload: body,
    });
    expect(bad.statusCode).toBe(403);
    const ok = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...proxied, origin: ORIGIN },
      payload: body,
    });
    expect(ok.statusCode).toBe(200);
  });

  it('본문은 1MB까지', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/echo',
      headers: { ...proxied, origin: ORIGIN, 'content-type': 'application/json' },
      payload: JSON.stringify({ x: 'a'.repeat(1024 * 1024 + 10) }),
    });
    expect(res.statusCode).toBe(413);
  });

  it('서버 오류는 내부 내용(SQL·스택)을 숨긴다', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/boom', headers: proxied });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret_table');
    expect(res.json()).toEqual({ error: 'server_error' });
  });

  it('요청이 너무 많으면 429', async () => {
    let last = 0;
    for (let i = 0; i < 301; i++)
      last = (await app.inject({ method: 'GET', url: '/healthz' })).statusCode;
    expect(last).toBe(429);
  });
});

describe('DB 마이그레이션', () => {
  it('여러 번 실행해도 한 번만 적용된다', () => {
    migrate(db);
    migrate(db);
    const rows = db.prepare('SELECT version FROM schema_migrations').all();
    expect(rows).toHaveLength(1);
    expect(db.prepare("SELECT value FROM counters WHERE name = 'rev'").get()).toEqual({ value: 0 });
  });
});
