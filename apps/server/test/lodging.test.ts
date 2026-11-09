import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { runMaintenance } from '../src/services/maintenance';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET });

let db: Db;
let app: FastifyInstance;
const sid: Record<string, string> = {};

const call = (
  who: string | null,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  payload?: object,
) =>
  app.inject({
    method,
    url,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(who ? { cookie: `__Host-sid=${sid[who]}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  ['A', 'B', 'M'].forEach((n, i) => {
    db.prepare('INSERT INTO users (id, nickname, created_at, is_admin) VALUES (?, ?, ?, ?)').run(
      `u-${n}`,
      `닉${n}`,
      `2026-01-0${i + 1}`,
      n === 'M' ? 1 : 0,
    );
    sid[n] = createSession(db, `u-${n}`, 't');
  });
  db.prepare(
    "INSERT INTO fx_rates (date, currency, rate, fetched_at) VALUES ('2026-11-09', 'JPY', 9.2, 'x')",
  ).run();
});
afterEach(async () => {
  await app.close();
  db.close();
});

const report = (o: object = {}) => ({
  hotelKey: 'agoda:706347',
  hotelName: '호텔 그레이스리 신주쿠',
  city: '도쿄',
  checkIn: '2026-11-24',
  nights: 3,
  adults: 2,
  rooms: 1,
  site: 'agoda',
  route: 'shinhan',
  price: 121300,
  priceType: 'nightly',
  currency: 'KRW',
  tax: 'incl',
  tags: ['member'],
  ...o,
});
const list = async (who: string, q = 'hotelKey=agoda:706347') =>
  (await call(who, 'GET', `/api/lodging/reports?${q}`)).json() as {
    reports: { id: string; mine: boolean; seenOn: string; price: number; site: string }[];
  };

describe('숙소 가격 기록 (docs/28 §7, ADR-0010)', () => {
  it('로그인 필요 — 보기·적기·지우기 모두', async () => {
    expect((await call(null, 'GET', '/api/lodging/reports?hotelKey=agoda:1')).statusCode).toBe(401);
    expect((await call(null, 'POST', '/api/lodging/reports', report())).statusCode).toBe(401);
    expect((await call(null, 'DELETE', '/api/lodging/reports/x')).statusCode).toBe(401);
    expect((await call('A', 'GET', '/api/admin/lodging/reports')).statusCode).toBe(403);
  });

  it('적으면 로그인한 모두가 보고, 작성자는 mine만 (user_id 없음), 본 시각은 날짜만', async () => {
    const res = await call('A', 'POST', '/api/lodging/reports', report());
    expect(res.statusCode).toBe(200);
    const b = await list('B');
    expect(b.reports).toHaveLength(1);
    expect(b.reports[0]).toMatchObject({ mine: false, price: 121300, site: 'agoda' });
    expect(b.reports[0]!.seenOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const raw = JSON.stringify(b);
    expect(raw).not.toContain('u-A');
    expect(raw).not.toContain('닉A');
    expect(raw).not.toMatch(/seen_?at|user/i);
    expect((await list('A')).reports[0]!.mine).toBe(true);
  });

  it('입력 검사·가격 범위 (원화·환율 아는 통화), 같은 것을 1시간 안에 다시 적으면 덮어쓴다', async () => {
    expect(
      (await call('A', 'POST', '/api/lodging/reports', report({ note: '메모' }))).statusCode,
    ).toBe(200);
    expect(
      (await call('A', 'POST', '/api/lodging/reports', report({ site: 'x' }))).statusCode,
    ).toBe(400);
    expect(
      (await call('A', 'POST', '/api/lodging/reports', report({ price: 100 }))).statusCode,
    ).toBe(422);
    // 1박 ¥100 × 9.2 = 920원 → 범위 밖, ¥13,000 → 119,600원 정상
    expect(
      (await call('A', 'POST', '/api/lodging/reports', report({ currency: 'JPY', price: 100 })))
        .statusCode,
    ).toBe(422);
    expect(
      (await call('A', 'POST', '/api/lodging/reports', report({ currency: 'JPY', price: 13000 })))
        .statusCode,
    ).toBe(200);
    const b = await list('B');
    expect(b.reports).toHaveLength(1);
    expect(b.reports[0]!.price).toBe(13000);
    // 다른 경로는 따로
    await call('A', 'POST', '/api/lodging/reports', report({ route: 'visa' }));
    expect((await list('B')).reports).toHaveLength(2);
    // 이름 열쇠로 적은 기록도 두 번째 열쇠로 함께
    await call('B', 'POST', '/api/lodging/reports', report({ hotelKey: 'name:그레이스리신주쿠|' }));
    expect(
      (
        await list(
          'A',
          `hotelKey=agoda:706347&altKey=${encodeURIComponent('name:그레이스리신주쿠|')}`,
        )
      ).reports,
    ).toHaveLength(3);
    expect(
      (await call('A', 'GET', '/api/lodging/reports?hotelKey=agoda:1&altKey=bad')).statusCode,
    ).toBe(400);
  });

  it('남의 기록은 못 지우고, 관리자는 지울 수 있다', async () => {
    const id = (
      (await call('A', 'POST', '/api/lodging/reports', report())).json() as {
        report: { id: string };
      }
    ).report.id;
    expect((await call('B', 'DELETE', `/api/lodging/reports/${id}`)).statusCode).toBe(404);
    expect((await call('A', 'DELETE', `/api/lodging/reports/${id}`)).statusCode).toBe(200);
    const id2 = (
      (await call('A', 'POST', '/api/lodging/reports', report())).json() as {
        report: { id: string };
      }
    ).report.id;
    expect((await call('M', 'GET', '/api/admin/lodging/reports')).json()).toMatchObject({
      total: 1,
    });
    expect((await call('M', 'DELETE', `/api/admin/lodging/reports/${id2}`)).statusCode).toBe(200);
    expect((await list('A')).reports).toHaveLength(0);
  });

  it('하루 60개 한도, 30일 지나면 정리, 탈퇴하면 그 사람 기록 삭제', async () => {
    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO lodging_price_reports (id, user_id, hotel_key, hotel_name, check_in, nights, adults, rooms,
         site, price, price_type, currency, tax, tags, seen_at, expires_at)
       VALUES (?, 'u-A', 'agoda:9', 'x', '2026-11-24', 1, 2, 1, 'agoda', 100000, 'nightly', 'KRW', 'incl', '', ?, ?)`,
    );
    for (let i = 0; i < 60; i++) insert.run(`r${i}`, now, '2999-01-01T00:00:00Z');
    const over = await call('A', 'POST', '/api/lodging/reports', report());
    expect(over.statusCode).toBe(429);
    expect(over.json()).toMatchObject({ error: 'report_daily' });

    insert.run('old', '2020-01-01T00:00:00Z', '2020-01-31T00:00:00Z');
    expect(runMaintenance(db)).toMatchObject({ lodgingReports: 1 });

    expect((await call('A', 'DELETE', '/api/me')).statusCode).toBe(200);
    expect(
      (db.prepare('SELECT COUNT(*) AS n FROM lodging_price_reports').get() as { n: number }).n,
    ).toBe(0);
  });
});
