import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';

/** 국내 공항 터미널·체크인 카운터·게이트 (공공데이터포털, 2026-11-02) */
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  DATA_GO_KR_KEY: 'k',
});
const kst = (days: number) =>
  new Date(Date.now() + 9 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);

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
    const url = String(input);
    urls.push(url);
    if (url.includes('getFltDeparturesDeOdp'))
      return Response.json({
        response: {
          body: {
            items: [
              {
                flightId: 'KE703',
                scheduleDatetime: `${kst(1).replace(/-/g, '')}0955`,
                estimatedDatetime: `${kst(1).replace(/-/g, '')}1010`,
                chkinRange: 'A B C D',
                gateNumber: '256',
                terminalId: 'P03',
                remark: null,
              },
            ],
          },
        },
      });
    if (url.includes('flight-search/info'))
      return Response.json({
        response: {
          body: {
            items: {
              item: [{ gate: '4', std: '0600', etd: '0619', line: '국내', rmkKor: '출발' }],
            },
          },
        },
      });
    return new Response('', { status: 404 });
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

const get = (q: string, cookie = true) =>
  app.inject({
    method: 'GET',
    url: `/api/flights/KE703/airport?${q}`,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(cookie ? { cookie: `__Host-sid=${sid}` } : {}),
    },
  });

it('로그인해야 하고, 인천 출발편은 T2·체크인 카운터·게이트, 해외 도착 공항은 없음', async () => {
  expect((await get(`date=${kst(1)}&from=ICN&to=NRT`, false)).statusCode).toBe(401);
  const res = await get(`date=${kst(1)}&from=ICN&to=NRT`);
  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({
    dep: {
      info: {
        airport: 'ICN',
        terminal: 'T2',
        counter: 'A B C D',
        gate: '256',
        scheduled: '09:55',
        estimated: '10:10',
      },
    },
    arr: null,
  });
  expect(res.json().dep.info).not.toHaveProperty('status');
  expect(urls.every((u) => !u.includes('serviceKey=k&') || u.includes('flightId=KE703'))).toBe(
    true,
  );
});

it('인천은 6일 뒤보다 먼 날이면 부르지 않고 언제부터 되는지, 김포는 오늘만', async () => {
  const far = await get(`date=${kst(10)}&from=ICN&to=GMP&arrDate=${kst(10)}`);
  expect(far.json().dep).toEqual({ from: kst(4) });
  expect(far.json().arr).toEqual({ from: kst(10) });
  expect(urls).toEqual([]);
  const today = await get(`date=${kst(0)}&from=GMP&to=CJU`);
  expect(today.json().dep.info).toMatchObject({ airport: 'GMP', gate: '4', terminal: '국내선' });
});

it('형식이 틀린 편명·날짜·공항은 400', async () => {
  expect((await get('date=2026-1-1&from=ICN')).statusCode).toBe(400);
  expect((await get(`date=${kst(1)}&from=ICN1`)).statusCode).toBe(400);
});
