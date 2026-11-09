import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { priceQueryOf } from '../src/routes/lodging';
import { parseHotels, pricesState, resetHotelPrices } from '../src/services/serpapiHotels';

/** 구글 호텔 참고 가격 (docs/28 §4.3·§8) — 실제 SerpApi에는 묻지 않는다 */
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const base = { NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET };

let db: Db;
let app: FastifyInstance;
let sid = '';
const urls: string[] = [];
let reply: (url: URL) => Response;

const rate = (n: number) => ({ extracted_lowest: n, extracted_display_price: n });
/** 2026-11-09 실제 응답(숙소 하나로 맞은 경우)을 줄인 모양 */
const hotel = {
  search_information: { hotels_results_state: 'Showing results for property details' },
  type: 'hotel',
  name: '호텔 그레이스리 신주쿠',
  prices: [
    {
      source: 'Hotel Gracery Shinjuku',
      official: true,
      rate_per_night: rate(401538),
      total_rate: rate(1204615),
    },
    { source: 'klook', rate_per_night: rate(335805), total_rate: rate(1007414) },
    { source: 'Booking.com', rate_per_night: rate(416419), total_rate: rate(1249256) },
    { source: 'Booking.com', rate_per_night: rate(399000) },
    { source: '', rate_per_night: rate(1) },
    { source: 'Agoda', rate_per_night: {} },
  ],
  nearby_places: [{ name: 'Meiji Jingu' }],
};
/** 이름이 여러 숙소에 맞은 경우 — 목록 */
const list = {
  properties: [
    { type: 'vacation rental', name: '아파트', property_token: 'v1' },
    { type: 'hotel', name: '신주쿠 워싱턴 호텔', property_token: 'tok1' },
  ],
};

const start = async (key: string | null = 'k'.repeat(64)) => {
  db = openDb(':memory:');
  app = await buildApp(loadConfig({ ...base, ...(key ? { SERPAPI_KEY: key } : {}) }), db);
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u1', '닉', 'x')").run();
  sid = createSession(db, 'u1', 't');
};

beforeEach(async () => {
  resetHotelPrices();
  urls.length = 0;
  await start();
  reply = () => Response.json(hotel);
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(String(url));
    return reply(new URL(url));
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const ask = (name = '신주쿠 그레이스리', cookie = true, extra = '') =>
  app.inject({
    method: 'GET',
    url: `/api/lodging/prices?name=${encodeURIComponent(name)}&checkIn=2026-11-24&checkOut=2026-11-27&adults=2${extra}`,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(cookie ? { cookie: `__Host-sid=${sid}` } : {}),
    },
  });

describe('구글 호텔 참고 가격', () => {
  it('로그인 필요, 예약처마다 가장 싼 1줄을 1박 오름차순으로, 보내는 것은 이름·날짜·인원·통화뿐', async () => {
    expect((await ask('x', false)).statusCode).toBe(401);
    const res = await ask();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      hotel: {
        name: '호텔 그레이스리 신주쿠',
        prices: [
          { source: 'klook', nightlyKrw: 335805, totalKrw: 1007414 },
          { source: 'Booking.com', nightlyKrw: 399000 },
          {
            source: 'Hotel Gracery Shinjuku',
            nightlyKrw: 401538,
            totalKrw: 1204615,
            official: true,
          },
        ],
      },
    });
    const u = new URL(urls[0]!);
    expect(u.origin + u.pathname).toBe('https://serpapi.com/search.json');
    expect([...u.searchParams.keys()].sort()).toEqual([
      'adults',
      'api_key',
      'check_in_date',
      'check_out_date',
      'currency',
      'engine',
      'gl',
      'hl',
      'q',
    ]);
    expect(u.searchParams.get('q')).toBe('신주쿠 그레이스리');
    expect(u.searchParams.get('currency')).toBe('KRW');
  });

  it('목록이 오면 첫 호텔 token으로 1번 더 (최대 2번)', async () => {
    reply = (u) => Response.json(u.searchParams.get('property_token') ? hotel : list);
    const res = await ask('신주쿠');
    expect(res.json().hotel.name).toBe('호텔 그레이스리 신주쿠');
    expect(urls).toHaveLength(2);
    expect(new URL(urls[1]!).searchParams.get('property_token')).toBe('tok1');
  });

  it('두 번째도 목록이면 더 묻지 않고 결과 없음', async () => {
    reply = () => Response.json(list);
    expect((await ask('신주쿠')).json()).toEqual({ hotel: null });
    expect(urls).toHaveLength(2);
  });

  it('같은 조건은 다시 묻지 않는다 (6시간 캐시), 날짜가 다르면 새로', async () => {
    await ask();
    await ask('  신주쿠   그레이스리 ');
    expect(urls).toHaveLength(1);
    await app.inject({
      method: 'GET',
      url: `/api/lodging/prices?name=x&checkIn=2026-11-25&checkOut=2026-11-27&adults=2`,
      headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, cookie: `__Host-sid=${sid}` },
    });
    expect(urls).toHaveLength(2);
  });

  it('결과 없음은 실패가 아니다', async () => {
    reply = () =>
      Response.json({ error: "Google Hotels hasn't returned any results for this query." });
    expect((await ask()).json()).toEqual({ hotel: null });
    expect(pricesState().paused).toBe(false);
  });

  it('키가 없으면 묻지 않고 prices_off', async () => {
    await app.close();
    db.close();
    await start(null);
    expect((await ask()).json()).toEqual({ error: 'prices_off' });
    expect(urls).toHaveLength(0);
  });

  it('월 무료량 95%(250회 중 237회)에 닿으면 묻지 않고 prices_quota', async () => {
    db.prepare("INSERT INTO api_usage (api, date, count) VALUES ('serpapi_hotels', ?, 237)").run(
      new Date().toISOString().slice(0, 10),
    );
    const res = await ask();
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'prices_quota' });
    expect(urls).toHaveLength(0);
  });

  it('SerpApi가 검색을 다 썼다고 하면 무료량 끝으로 멈춘다', async () => {
    reply = () =>
      Response.json({ error: 'Your account has run out of searches.' }, { status: 429 });
    expect((await ask('a')).json()).toEqual({ error: 'prices_quota' });
    expect((await ask('b')).json()).toEqual({ error: 'prices_quota' });
    expect(urls).toHaveLength(1);
  });

  it('401·403이면 24시간 멈추고 더 묻지 않는다', async () => {
    reply = () => Response.json({ error: 'Invalid API key.' }, { status: 401 });
    expect((await ask('a')).statusCode).toBe(502);
    expect((await ask('b')).json()).toEqual({ error: 'prices_paused' });
    expect(urls).toHaveLength(1);
    expect(pricesState().until - Date.now()).toBeGreaterThan(23 * 3_600_000);
  });

  it('연속 실패 3번이면 30분 멈춤, 응답에 키가 섞이지 않는다', async () => {
    reply = () => new Response('x', { status: 500 });
    for (const n of ['a', 'b', 'c']) {
      const res = await ask(n);
      expect(res.statusCode).toBe(502);
      expect(res.body).not.toContain('kkkk');
    }
    expect((await ask('d')).statusCode).toBe(503);
    expect(urls).toHaveLength(3);
  });

  it('입력 검사: 이름·날짜·박 수·인원', () => {
    const ok = { name: 'a', checkIn: '2026-11-24', checkOut: '2026-11-27', adults: '2' };
    expect(priceQueryOf(ok)).toEqual({ ...ok, adults: 2 });
    expect(priceQueryOf({ ...ok, name: ' ' })).toBeNull();
    expect(priceQueryOf({ ...ok, name: 'a'.repeat(81) })).toBeNull();
    expect(priceQueryOf({ ...ok, checkOut: '2026-11-24' })).toBeNull();
    expect(priceQueryOf({ ...ok, checkOut: '2026-12-25' })).toBeNull();
    expect(priceQueryOf({ ...ok, adults: '9' })).toBeNull();
    expect(priceQueryOf({ ...ok, adults: undefined })).toBeNull();
  });

  it('모양이 다른 응답은 실패로', () => {
    expect(() => parseHotels({})).toThrow();
    expect(() => parseHotels(null)).toThrow();
    expect(() => parseHotels({ type: 'hotel' })).toThrow();
    expect(parseHotels({ properties: [] })).toBeNull();
  });
});
