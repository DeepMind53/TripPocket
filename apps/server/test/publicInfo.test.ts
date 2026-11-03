import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { dataItems, periodDays, resetPublicInfoCache } from '../src/services/publicInfo';

/** 무료 API 2·3단계 (docs/26, 2026-11-03) */
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const base = { NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET };

let db: Db | undefined;
let app: FastifyInstance | undefined;
let admin: string;
let member: string;
let urls: string[];
let reply: (url: string) => Response;

async function boot(env: Record<string, string> = {}) {
  const d = openDb(':memory:');
  db = d;
  app = await buildApp(loadConfig({ ...base, ...env }), d);
  d.prepare(
    "INSERT INTO users (id, nickname, created_at, is_admin) VALUES ('a', '관리자', '1', 1)",
  ).run();
  d.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('m', '홍길동', '2')").run();
  admin = createSession(d, 'a', 't');
  member = createSession(d, 'm', 't');
}

beforeEach(() => {
  resetPublicInfoCache();
  urls = [];
  reply = () => new Response('', { status: 404 });
  vi.stubGlobal('fetch', async (u: string) => {
    urls.push(String(u));
    return reply(String(u));
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  // 첫 시험은 앱을 띄우지 않는다
  await app?.close();
  db?.close();
});

const call = (method: 'GET' | 'POST', url: string, sid?: string, payload?: object) =>
  app!.inject({
    method,
    url,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(sid ? { cookie: `__Host-sid=${sid}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });
const wrap = (item: unknown) =>
  Response.json({ response: { header: { resultCode: '00' }, body: { items: { item } } } });

it('응답 모양 셋 다 읽고, 기간 글자를 일 수로', () => {
  expect(
    dataItems({ response: { header: { resultCode: '00' }, body: { items: { item: { a: 1 } } } } }),
  ).toEqual([{ a: 1 }]);
  expect(dataItems({ response: { body: { items: [{ a: 2 }] } } })).toEqual([{ a: 2 }]);
  expect(dataItems({ data: [{ a: 3 }] })).toEqual([{ a: 3 }]);
  expect(() => dataItems({ response: { header: { resultCode: '30' } } })).toThrow();
  // 한국관광공사는 정상 코드가 '0000'
  expect(
    dataItems({ response: { header: { resultCode: '0000' }, body: { items: [{ a: 4 }] } } }),
  ).toEqual([{ a: 4 }]);
  expect(periodDays('90일')).toBe(90);
  expect(periodDays('3개월')).toBe(90);
  expect(periodDays('불가')).toBeNull();
});

it('키가 없으면 503, 로그인 안 했으면 401', async () => {
  await boot();
  expect((await call('GET', '/api/info/safety/JP')).statusCode).toBe(401);
  expect((await call('GET', '/api/info/safety/JP', member)).statusCode).toBe(503);
  expect((await call('GET', '/api/info/flight/KE703', member)).statusCode).toBe(503);
});

it('안전공지: 나라 코드만 보내고 최신 3개', async () => {
  await boot({ DATA_GO_KR_KEY: 'k' });
  reply = () =>
    wrap([
      { title: '옛 공지', wrt_dt: '2026-01-01' },
      { title: '새 공지', wrt_dt: '2026-10-30' },
    ]);
  const res = await call('GET', '/api/info/safety/JP', member);
  expect(res.json().notices.map((n: { title: string }) => n.title)).toEqual(['새 공지', '옛 공지']);
  expect(urls[0]).toContain('CountrySafetyService7/getCountrySafetyList7');
  expect(urls[0]).toContain('cond[country_iso_alp2::EQ]=JP');
  expect(urls.join()).not.toMatch(/홍길동/);
});

it('축제: 여행 기간과 겹치고 30km 안인 것만, 가까운 순', async () => {
  await boot({ DATA_GO_KR_KEY: 'k' });
  reply = () =>
    wrap([
      {
        contentid: '1',
        title: '먼 축제',
        mapy: '35.1',
        mapx: '129.0',
        eventstartdate: '20261110',
        eventenddate: '20261112',
      },
      {
        contentid: '2',
        title: '가까운 축제',
        mapy: '37.57',
        mapx: '126.98',
        eventstartdate: '20261101',
        eventenddate: '20261130',
        firstimage: 'http://img/a.jpg',
      },
      {
        contentid: '3',
        title: '끝난 축제',
        mapy: '37.57',
        mapx: '126.98',
        eventstartdate: '20261001',
        eventenddate: '20261005',
      },
    ]);
  const res = await call('POST', '/api/info/festivals', member, {
    near: { lat: 37.56, lng: 126.97 },
    from: '2026-11-10',
    to: '2026-11-12',
  });
  expect(res.json().festivals).toEqual([
    expect.objectContaining({
      id: '2',
      title: '가까운 축제',
      start: '2026-11-01',
      end: '2026-11-30',
      image: 'https://img/a.jpg',
    }),
  ]);
  expect(urls[0]).toContain('searchFestival2');
  expect(urls[0]).toContain('eventStartDate=20261110');
  expect(urls[0]).not.toContain('37.56');
});

it('국내 미세먼지: 시도 측정소 평균, 모르는 시도는 400', async () => {
  await boot({ DATA_GO_KR_KEY: 'k' });
  reply = () =>
    wrap([
      { pm25Value: '20', dataTime: '2026-11-03 14:00' },
      { pm25Value: '40' },
      { pm25Value: '-' },
    ]);
  expect(
    (await call('GET', `/api/info/air-kr?sido=${encodeURIComponent('서울')}`, member)).json(),
  ).toEqual({
    air: { pm25: 30, at: '2026-11-03 14:00' },
  });
  expect((await call('GET', '/api/info/air-kr?sido=xx', member)).statusCode).toBe(400);
});

it('항공편 지연 (AirLabs): 편명만, 지연 분', async () => {
  await boot({ AIRLABS_KEY: 'al' });
  reply = () => Response.json({ response: { status: 'scheduled', dep_delayed: 35 } });
  expect((await call('GET', '/api/info/flight/ke703', member)).json()).toEqual({
    status: { status: 'scheduled', depDelay: 35 },
  });
  expect(urls[0]).toContain('flight_iata=KE703');
  expect((await call('GET', '/api/info/flight/x', member)).statusCode).toBe(400);
});

it('관리자 입국 점검: 관리자만, 앱 값과 외교부 값이 다르면 match=false', async () => {
  await boot({ DATA_GO_KR_KEY: 'k' });
  reply = (u) =>
    wrap({ gnrl_pspt_visa_yn: 'Y', gnrl_pspt_visa_cn: u.includes('EQ]=JP') ? '90일' : '15일' });
  expect((await call('GET', '/api/admin/entry-check', member)).statusCode).toBe(403);
  const { checks } = (await call('GET', '/api/admin/entry-check', admin)).json() as {
    checks: { code: string; app: number | null; official: number | null; match: boolean | null }[];
  };
  expect(checks.find((c) => c.code === 'JP')).toMatchObject({ app: 90, official: 90, match: true });
  expect(checks.some((c) => c.match === false)).toBe(true);
});
