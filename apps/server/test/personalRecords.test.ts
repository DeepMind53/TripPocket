import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { MIGRATIONS } from '../src/db/migrations';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET });
const T = '2026-10-23T00:00:00.000Z';
const U = (n: string) =>
  `00000000-0000-7000-8000-${Buffer.from(n).toString('hex').padStart(12, '0').slice(-12)}`;
const TRIP = U('t1');
const ITEM = U('i1');
let db: Db;
let app: FastifyInstance;
const sid: Record<string, string> = {};

const call = (who: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({
    method,
    url,
    headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, cookie: `__Host-sid=${sid[who]}` },
    ...(payload ? { payload } : {}),
  });

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  for (const n of ['owner', 'mate', 'viewer', 'stranger']) {
    db.prepare('INSERT INTO users (id, nickname, created_at) VALUES (?, ?, ?)').run(n, n, T);
    sid[n] = createSession(db, n, 't');
  }
  db.prepare(
    "INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES (?, 'owner', 'owner', 'x'), (?, 'mate', 'editor', 'x'), (?, 'viewer', 'viewer', 'x')",
  ).run(TRIP, TRIP, TRIP);
});
afterEach(async () => {
  await app.close();
  db.close();
});

const mark = (id: string, visit: 'visited' | 'skipped') => ({
  table: 'itemMarks',
  baseRev: null,
  record: { id, tripId: TRIP, itemId: ITEM, visit, createdAt: T, updatedAt: T },
});
const tables = async (who: string) =>
  (
    (await call(who, 'GET', '/api/sync/pull?since=0')).json() as {
      changes: { table: string; record: { id: string; visit?: string } }[];
    }
  ).changes;

describe('내 기록 분리 (2026-11-25): 방문 표시·하루 한 줄은 계정마다 따로', () => {
  it('멤버(보기 전용 포함)는 자기 표시만 쓰고, 받을 때도 자기 것만 — 남의 여행은 거부', async () => {
    for (const [who, id, v] of [
      ['owner', U('m1'), 'visited'],
      ['mate', U('m2'), 'skipped'],
      ['viewer', U('m3'), 'visited'],
    ] as const) {
      const r = (await call(who, 'POST', '/api/sync/push', { changes: [mark(id, v)] })).json();
      expect(r.applied).toHaveLength(1);
    }
    const stranger = (
      await call('stranger', 'POST', '/api/sync/push', { changes: [mark(U('m4'), 'visited')] })
    ).json();
    expect(stranger.rejected[0].reason).toBe('forbidden');
    // 남의 표시를 고칠 수 없다
    const steal = (
      await call('mate', 'POST', '/api/sync/push', { changes: [mark(U('m1'), 'skipped')] })
    ).json();
    expect(steal.rejected[0].reason).toBe('forbidden');
    const marks = async (who: string) =>
      (await tables(who)).filter((c) => c.table === 'itemMarks').map((c) => c.record.visit);
    expect(await marks('owner')).toEqual(['visited']);
    expect(await marks('mate')).toEqual(['skipped']);
    expect(await marks('viewer')).toEqual(['visited']);
  });

  it('마이그레이션 25: 예전 일정 방문·다녀옴과 여행 하루 한 줄을 여행 주인의 내 기록으로 옮기고 함께 보는 행에서 지운다', () => {
    const put = (table: string, id: string, trip: string | null, data: object, rev: number) =>
      db
        .prepare(
          'INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, rev) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(table, id, trip, 'mate', JSON.stringify({ id, ...data }), T, rev);
    put(
      'trips',
      TRIP,
      TRIP,
      { title: '도쿄', dayNotes: [{ date: '2026-11-01', text: '좋았다' }] },
      1,
    );
    put('items', ITEM, TRIP, { tripId: TRIP, title: '센소지', visit: 'visited', done: true }, 2);
    put('items', U('i2'), TRIP, { tripId: TRIP, title: '라멘' }, 3);
    db.prepare("UPDATE counters SET value = 3 WHERE name = 'rev'").run();
    db.exec(MIGRATIONS[24]!);
    const row = (table: string) =>
      db
        .prepare('SELECT owner_user_id, data_json, rev FROM records WHERE table_name = ?')
        .all(table) as { owner_user_id: string; data_json: string; rev: number }[];
    const [m] = row('itemMarks');
    expect(m!.owner_user_id).toBe('owner');
    expect(JSON.parse(m!.data_json)).toMatchObject({
      tripId: TRIP,
      itemId: ITEM,
      visit: 'visited',
      done: true,
    });
    const [n] = row('dayNotes');
    expect(JSON.parse(n!.data_json)).toMatchObject({ date: '2026-11-01', text: '좋았다' });
    // 함께 보는 행에서는 지우고 rev를 올려 일행 기기에도 반영
    const items = row('items').map(
      (r) => JSON.parse(r.data_json) as { title: string; visit?: string },
    );
    expect(items.find((i) => i.title === '센소지')).not.toHaveProperty('visit');
    expect(items.find((i) => i.title === '센소지')).not.toHaveProperty('done');
    const trip = row('trips')[0]!;
    expect(JSON.parse(trip.data_json)).not.toHaveProperty('dayNotes');
    expect(trip.rev).toBeGreaterThan(3);
    // 바뀌지 않은 일정은 그대로, 모든 rev는 겹치지 않는다
    const revs = db
      .prepare('SELECT rev FROM records')
      .all()
      .map((r) => Number(r.rev));
    expect(new Set(revs).size).toBe(revs.length);
    expect(
      Number(
        (db.prepare("SELECT value FROM counters WHERE name = 'rev'").get() as { value: number })
          .value,
      ),
    ).toBe(Math.max(...revs));
  });
});
