import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { lookupState, parseSuggest, resetAgodaLookup } from '../src/services/agodaLookup';

/** 아고다 숙소 자동 찾기 (docs/28 §4.2·§8) — 실제 아고다에는 묻지 않는다 */
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET });

let db: Db;
let app: FastifyInstance;
let sid = '';
const urls: string[] = [];
let reply: () => Response;

const suggest = {
  ViewModelList: [
    { IsHotel: false, ObjectId: 0, Name: '신주쿠 그레이스리' },
    { IsHotel: true, ObjectId: 706347, Name: 'Hotel Gracery Shinjuku', CityName: 'Tokyo' },
    { IsHotel: false, ObjectId: 28049, Name: 'Shinjuku', CityName: 'Tokyo' },
    { IsHotel: true, ObjectId: 60887367, Name: 'Gracious Higashi Shinjuku', CityName: 'Tokyo' },
  ],
};

beforeEach(async () => {
  resetAgodaLookup();
  urls.length = 0;
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', '닉', 'x')").run();
  sid = createSession(db, 'u1', 't');
  reply = () => Response.json(suggest);
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    urls.push(String(url));
    expect(init?.redirect).toBe('manual');
    return reply();
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const look = (name: string, cookie = true) =>
  app.inject({
    method: 'GET',
    url: `/api/lodging/lookup?name=${encodeURIComponent(name)}`,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(cookie ? { cookie: `__Host-sid=${sid}` } : {}),
    },
  });

describe('아고다 숙소 자동 찾기', () => {
  it('로그인 필요, 숙소만 최대 3개, 보내는 것은 숙소 이름뿐', async () => {
    expect((await look('x', false)).statusCode).toBe(401);
    const res = await look('신주쿠 그레이스리');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      candidates: [
        { hid: 706347, name: 'Hotel Gracery Shinjuku', city: 'Tokyo' },
        { hid: 60887367, name: 'Gracious Higashi Shinjuku', city: 'Tokyo' },
      ],
    });
    const u = new URL(urls[0]!);
    expect(u.hostname).toBe('www.agoda.com');
    expect([...u.searchParams.keys()].sort()).toEqual([
      'cid',
      'origin',
      'pageTypeId',
      'searchText',
    ]);
    expect(u.searchParams.get('searchText')).toBe('신주쿠 그레이스리');
  });

  it('같은 이름은 다시 묻지 않는다 (30일 캐시)', async () => {
    await look('신주쿠 그레이스리');
    await look('  신주쿠   그레이스리 ');
    expect(urls).toHaveLength(1);
  });

  it('차단 신호(403·로봇 확인 HTML)면 그 자리에서 24시간 멈추고 더 묻지 않는다', async () => {
    reply = () =>
      new Response('<html>captcha</html>', { headers: { 'content-type': 'text/html' } });
    expect((await look('a')).statusCode).toBe(502);
    expect(lookupState().paused).toBe(true);
    expect((await look('b')).json()).toEqual({ error: 'lookup_paused' });
    expect(urls).toHaveLength(1);
  });

  it('연속 실패 3번이면 30분 멈춤', async () => {
    reply = () => new Response('x', { status: 500 });
    for (const n of ['a', 'b', 'c']) expect((await look(n)).statusCode).toBe(502);
    expect((await look('d')).statusCode).toBe(503);
    expect(urls).toHaveLength(3);
    expect(lookupState().until - Date.now()).toBeGreaterThan(29 * 60_000);
  });

  it('하루 상한(apiUsage 100회의 95%)에 닿으면 api_paused로 멈춘다', async () => {
    db.prepare("INSERT INTO api_usage (api, date, count) VALUES ('agoda_lookup', ?, 95)").run(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()),
    );
    const res = await look('e');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: 'api_paused', api: 'agoda_lookup' });
    expect(urls).toHaveLength(0);
  });

  it('모양이 다른 응답은 실패로', () => {
    expect(() => parseSuggest({})).toThrow();
    expect(parseSuggest({ ViewModelList: [{ IsHotel: true, ObjectId: -1, Name: 'x' }] })).toEqual(
      [],
    );
  });
});
