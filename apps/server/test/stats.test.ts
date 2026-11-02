import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { statDate, STATS_KEEP_DAYS, statsRepo } from '../src/repositories/statsRepo';

/** 사용 통계 (ADR-0009): 관리자만 보고, 사람 구분 없는 합계만 남는다 */
const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET });

let db: Db;
let app: FastifyInstance;
let admin: string;
let user: string;

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  db.prepare(
    "INSERT INTO users (id, nickname, created_at, is_admin) VALUES ('a1', '관리자', '2026-10-01T00:00:00Z', 1), ('u1', '홍길동', '2026-10-02T00:00:00Z', 0)",
  ).run();
  admin = createSession(db, 'a1', 'Mozilla/5.0 (iPhone) Safari/604.1');
  user = createSession(db, 'u1', 'Mozilla/5.0 (Linux; Android 14) Chrome/130');
});
afterEach(async () => {
  await app.close();
  db.close();
});

const call = (method: 'GET' | 'POST', url: string, sid?: string, payload?: object) =>
  app.inject({
    method,
    url,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(sid ? { cookie: `__Host-sid=${sid}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });

const rows = () =>
  db.prepare('SELECT date, kind, name, count FROM usage_stats').all() as {
    date: string;
    kind: string;
    name: string;
    count: number;
  }[];

describe('사용 통계', () => {
  it('통계 보기는 관리자만 (로그인 안 하면 401, 일반 사용자는 403)', async () => {
    expect((await call('GET', '/api/admin/stats')).statusCode).toBe(401);
    expect((await call('GET', '/api/admin/stats', user)).statusCode).toBe(403);
    const res = await call('GET', '/api/admin/stats?days=30', admin);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ days: 30, users: { total: 2 } });
  });

  it('기능 횟수 보내기는 로그인해야 하고, 다른 주소에서 보내면 막는다', async () => {
    const body = { days: { [statDate()]: { 'screen:/trips': 3 } } };
    expect((await call('POST', '/api/stats/events', undefined, body)).statusCode).toBe(401);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/stats/events',
      headers: { [PROXY_HEADER]: SECRET, origin: 'https://evil.dev', cookie: `__Host-sid=${user}` },
      payload: body,
    });
    expect(bad.statusCode).toBe(403);
    expect(rows().filter((r) => r.kind === 'event')).toEqual([]);
  });

  it('보낸 횟수는 합계로만 — 이상한 이름·오래된 날짜·큰 수는 버리거나 줄이고, 사용자 id는 남지 않는다', async () => {
    const today = statDate();
    const res = await call('POST', '/api/stats/events', user, {
      days: {
        [today]: {
          'screen:/trips/:id': 2,
          'env.os.android': 1,
          '<script>': 5,
          '홍길동 검색': 1,
          'map.open': 99999,
        },
        '2020-01-01': { 'screen:/old': 1 },
      },
    });
    expect(res.statusCode).toBe(200);
    const ev = rows().filter((r) => r.kind === 'event' || r.kind === 'env');
    expect(ev.map((r) => [r.kind, r.name, r.count]).sort()).toEqual([
      ['env', 'env.os.android', 1],
      ['event', 'map.open', 500],
      ['event', 'screen:/trips/:id', 2],
    ]);
    expect(JSON.stringify(rows())).not.toMatch(/u1|홍길동/);
  });

  it('요청·하루 사용자·입력/수정/삭제를 센다 (하루 사용자는 사람마다 하루 한 번)', async () => {
    await call('GET', '/api/me', user);
    await call('GET', '/api/me', user);
    const trip = {
      id: '0192f000-0000-7000-8000-000000000001',
      title: '도쿄',
      destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      timezone: 'Asia/Tokyo',
      cover: {},
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };
    await call('POST', '/api/sync/push', user, {
      changes: [{ table: 'trips', record: trip, baseRev: null }],
    });
    await call('POST', '/api/sync/push', user, {
      changes: [
        {
          table: 'trips',
          record: {
            ...trip,
            deletedAt: '2026-11-02T00:00:00.000Z',
            updatedAt: '2026-11-02T00:00:00.000Z',
          },
          baseRev: 1,
        },
      ],
    });
    const r = rows();
    const get = (kind: string, name: string) =>
      r.find((x) => x.kind === kind && x.name === name)?.count;
    expect(get('active', 'users')).toBe(1);
    expect(get('api', 'GET /api/me')).toBe(2);
    expect(get('data', 'trips.create')).toBe(1);
    expect(get('data', 'trips.delete')).toBe(1);
    const sum = (await call('GET', '/api/admin/stats', admin)).json();
    expect(sum.users.active1).toBe(1); // 관리자는 이 응답을 보낸 뒤에 더해진다
    expect(sum.api.find((a: { route: string }) => a.route === 'GET /api/me')).toMatchObject({
      n: 2,
      p50: 100,
    });
    expect(sum.devices.os.map((x: { name: string }) => x.name).sort()).toEqual(['Android', 'iOS']);
  });

  it('재방문·쓴 날 수·시간대·기능을 쓴 기기 수 (사람 구분 없이)', async () => {
    // 가입 40일 전, 마지막 사용 오늘 → 7·30일 재방문 모두 포함
    db.prepare(
      "UPDATE users SET created_at = ?, last_active_date = ?, active_days = 12 WHERE id = 'u1'",
    ).run(new Date(Date.now() - 40 * 86_400_000).toISOString(), statDate());
    await call('POST', '/api/stats/events', user, {
      days: { [statDate()]: { 'reach.screen:/trips': 1, 'screen:/trips': 4 } },
    });
    const sum = (await call('GET', '/api/admin/stats', admin)).json();
    expect(sum.users.retention30).toEqual({ base: 2, back: 1 });
    expect(sum.users.activeDays.find((r: { name: string }) => r.name === '8-30').n).toBe(1);
    expect(sum.users.hours).toHaveLength(24);
    expect(sum.users.hours.reduce((a: number, r: { n: number }) => a + r.n, 0)).toBeGreaterThan(0);
    expect(sum.reach).toEqual([{ name: 'screen:/trips', n: 1 }]);
    expect(sum.events).toEqual([{ name: 'screen:/trips', n: 4 }]);
  });

  it('샘플로 만든 여행과 그 안의 일정은 입력 통계·여행 현황에 넣지 않는다', async () => {
    const trip = {
      id: '0192f000-0000-7000-8000-000000000009',
      title: '[샘플] 도쿄 5일',
      destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      timezone: 'Asia/Tokyo',
      cover: {},
      sample: true,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };
    const item = {
      id: '0192f000-0000-7000-8000-00000000000a',
      tripId: trip.id,
      date: '2026-12-01',
      order: 'a0',
      kind: 'place',
      title: '센소지',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };
    const res = await call('POST', '/api/sync/push', user, {
      changes: [
        { table: 'trips', record: trip, baseRev: null },
        { table: 'items', record: item, baseRev: null },
      ],
    });
    expect(res.json().applied).toHaveLength(2);
    expect(rows().filter((r) => r.kind === 'data')).toEqual([]);
    const sum = (await call('GET', '/api/admin/stats', admin)).json();
    expect(sum.trips.total).toBe(0);
    expect(sum.trips.perTrip.items).toBe(0);
  });

  it('3년 지난 통계는 지운다', () => {
    const stats = statsRepo(db);
    const old = statDate(new Date(Date.now() - (STATS_KEEP_DAYS + 2) * 86_400_000));
    db.prepare("INSERT INTO usage_stats VALUES (?, 'event', 'x', 1)").run(old);
    stats.bump('event', 'y');
    expect(rows().map((x) => x.name)).toEqual(['y']);
  });
});
