import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';

const ORIGIN = 'https://trippocket.pages.dev';
const SECRET = 's'.repeat(40);
const config = loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET });

let db: Db;
let app: FastifyInstance;
let A: string;
let B: string;

const T = '2026-10-23T00:00:00.000Z';
/** 읽기 쉬운 이름 → 형식에 맞는 UUID (예: 't1' → ...-74310000) */
const U = (name: string) =>
  `00000000-0000-7000-8000-${Buffer.from(name).toString('hex').padStart(12, '0').slice(-12)}`;
const trip = (id: string, extra: object = {}) => ({
  id,
  title: '도쿄',
  destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
  startDate: '2026-11-01',
  endDate: '2026-11-03',
  timezone: 'Asia/Tokyo',
  cover: {},
  createdAt: T,
  updatedAt: T,
  ...extra,
});
const item = (id: string, tripId: string) => ({
  id,
  tripId,
  date: '2026-11-01',
  order: 'a0',
  kind: 'place',
  title: '센소지',
  createdAt: T,
  updatedAt: T,
});

function userWithSession(name: string): string {
  const id = `u-${name}`;
  db.prepare('INSERT INTO users (id, nickname, created_at) VALUES (?, ?, ?)').run(id, name, T);
  return createSession(db, id, 'test');
}

const push = (sid: string, changes: unknown[]) =>
  app.inject({
    method: 'POST',
    url: '/api/sync/push',
    headers: { [PROXY_HEADER]: SECRET, origin: ORIGIN, cookie: `__Host-sid=${sid}` },
    payload: { changes },
  });
const pull = (sid: string, since = 0, limit?: number) =>
  app.inject({
    method: 'GET',
    url: `/api/sync/pull?since=${since}${limit ? `&limit=${limit}` : ''}`,
    headers: { [PROXY_HEADER]: SECRET, cookie: `__Host-sid=${sid}` },
  });

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  A = userWithSession('A');
  B = userWithSession('B');
});
afterEach(async () => {
  await app.close();
  db.close();
});

describe('동기화', () => {
  it('올린 여행·일정은 서버 순번(rev)을 받고, 본인만 내려받는다', async () => {
    const res = await push(A, [
      { table: 'trips', record: trip(U('t1')), baseRev: null },
      { table: 'items', record: item(U('i1'), U('t1')), baseRev: null },
    ]);
    expect(res.json()).toEqual({
      applied: [
        { table: 'trips', id: U('t1'), rev: 1 },
        { table: 'items', id: U('i1'), rev: 2 },
      ],
      rejected: [],
    });
    const mine = (await pull(A)).json();
    expect(
      mine.changes.map((c: { record: { id: string; rev: number } }) => [c.record.id, c.record.rev]),
    ).toEqual([
      [U('t1'), 1],
      [U('i1'), 2],
    ]);
    expect(mine.nextRev).toBe(2);
    expect((await pull(B)).json().changes).toEqual([]);
  });

  it('남의 여행에 일정 넣기·여행 고치기·같은 id로 가로채기는 거부 (있는지도 알리지 않음)', async () => {
    await push(A, [{ table: 'trips', record: trip(U('t1')), baseRev: null }]);
    const res = await push(B, [
      { table: 'items', record: item(U('i9'), U('t1')), baseRev: null },
      { table: 'trips', record: trip(U('t1'), { title: '탈취' }), baseRev: 1 },
    ]);
    expect(res.json().rejected).toEqual([
      { table: 'items', id: U('i9'), reason: 'forbidden' },
      { table: 'trips', id: U('t1'), reason: 'forbidden' },
    ]);
    const stored = (await pull(A)).json().changes[0].record;
    expect(stored.title).toBe('도쿄');
  });

  it('개인 데이터(템플릿)는 본인만 — 같은 id로 덮어쓰기 거부', async () => {
    const tpl = {
      id: U('tp1'),
      list: 'packing',
      name: '기본',
      items: [],
      order: 'a0',
      createdAt: T,
      updatedAt: T,
    };
    await push(A, [{ table: 'checklistTemplates', record: tpl, baseRev: null }]);
    const res = await push(B, [
      { table: 'checklistTemplates', record: { ...tpl, name: '바꿈' }, baseRev: 1 },
    ]);
    expect(res.json().rejected[0]?.reason).toBe('forbidden');
  });

  it('보기 전용 멤버는 못 고치고, 편집 멤버도 여행 삭제는 못 한다', async () => {
    await push(A, [{ table: 'trips', record: trip(U('t1')), baseRev: null }]);
    db.prepare(
      "INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES (?, 'u-B', 'viewer', ?)",
    ).run(U('t1'), T);
    expect((await pull(B)).json().changes).toHaveLength(1); // 볼 수는 있음
    expect(
      (await push(B, [{ table: 'items', record: item(U('i1'), U('t1')), baseRev: null }])).json()
        .rejected,
    ).toHaveLength(1);
    db.prepare("UPDATE trip_members SET role = 'editor' WHERE user_id = 'u-B'").run();
    expect(
      (await push(B, [{ table: 'items', record: item(U('i1'), U('t1')), baseRev: null }])).json()
        .applied,
    ).toHaveLength(1);
    const del = await push(B, [
      { table: 'trips', record: trip(U('t1'), { deletedAt: T }), baseRev: 1 },
    ]);
    expect(del.json().rejected[0]?.reason).toBe('forbidden');
  });

  it('충돌: 기기가 본 뒤 서버가 바뀌었으면 진 쪽을 보관하고 나중 도착분 채택', async () => {
    await push(A, [{ table: 'trips', record: trip(U('t1')), baseRev: null }]);
    await push(A, [{ table: 'trips', record: trip(U('t1'), { title: '폰에서' }), baseRev: 1 }]);
    await push(A, [{ table: 'trips', record: trip(U('t1'), { title: 'PC에서' }), baseRev: 1 }]);
    expect((await pull(A)).json().changes[0].record.title).toBe('PC에서');
    const lost = db.prepare('SELECT losing_data_json FROM conflicts').all() as {
      losing_data_json: string;
    }[];
    expect(lost).toHaveLength(1);
    expect(JSON.parse(lost[0]!.losing_data_json).title).toBe('폰에서');
  });

  it('형식이 틀린 행만 거부하고 나머지는 적용, 요청 자체가 틀리면 400, 로그인 안 하면 401', async () => {
    const res = await push(A, [
      { table: 'trips', record: { id: 'bad', title: 1 }, baseRev: null },
      { table: 'trips', record: trip(U('t2')), baseRev: null },
    ]);
    expect(res.json().rejected).toEqual([{ table: 'trips', id: 'bad', reason: 'invalid' }]);
    expect(res.json().applied).toHaveLength(1);
    expect((await push(A, [{ table: 'users', record: {}, baseRev: null }])).statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/sync/pull',
          headers: { [PROXY_HEADER]: SECRET },
        })
      ).statusCode,
    ).toBe(401);
  });

  it('나눠 받기: limit과 hasMore', async () => {
    await push(
      A,
      [1, 2, 3].map((n) => ({ table: 'trips', record: trip(U(`t${n}`)), baseRev: null })),
    );
    const first = (await pull(A, 0, 2)).json();
    expect(first.changes).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const rest = (await pull(A, first.nextRev, 2)).json();
    expect(rest.changes.map((c: { record: { id: string } }) => c.record.id)).toEqual([U('t3')]);
    expect(rest.hasMore).toBe(false);
  });
});

describe('저장한 장소 200곳 제한', () => {
  const saved = (id: string) => ({
    id,
    name: '이치란',
    kind: 'food',
    countryCode: 'JP',
    createdAt: T,
    updatedAt: T,
  });

  it('200곳이 차면 새로 올린 것만 거절(limit), 있던 것 고치기·다른 사람은 그대로', async () => {
    const insert = db.prepare(
      "INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, deleted_at, rev) VALUES ('savedPlaces', ?, NULL, 'u-A', ?, ?, NULL, ?)",
    );
    for (let n = 0; n < 200; n++) {
      const id = U(`s${n}`);
      insert.run(id, JSON.stringify(saved(id)), T, n + 1);
    }
    const res = (
      await push(A, [{ table: 'savedPlaces', record: saved(U('new')), baseRev: null }])
    ).json();
    expect(res.rejected).toEqual([{ table: 'savedPlaces', id: U('new'), reason: 'limit' }]);

    const edit = { ...saved(U('s0')), name: '이치란 본점', updatedAt: '2026-10-24T00:00:00.000Z' };
    const ok = (await push(A, [{ table: 'savedPlaces', record: edit, baseRev: 1 }])).json();
    expect(ok.applied).toHaveLength(1);

    const other = (
      await push(B, [{ table: 'savedPlaces', record: saved(U('b1')), baseRev: null }])
    ).json();
    expect(other.applied).toHaveLength(1);
  });
});

describe('준비 목록은 사람마다 (2026-10-27)', () => {
  const check = (id: string, tripId: string, extra: object = {}) => ({
    id,
    tripId,
    list: 'packing',
    text: '여권',
    checked: false,
    order: 'a0',
    createdAt: T,
    updatedAt: T,
    ...extra,
  });
  const T1 = U('t1');
  const changesOf = async (sid: string) =>
    (await pull(sid))
      .json<{ changes: { table: string; record: Record<string, unknown> }[] }>()
      .changes.filter((c) => c.table === 'checklistItems')
      .map((c) => c.record);

  beforeEach(async () => {
    await push(A, [{ table: 'trips', record: trip(T1), baseRev: null }]);
    db.prepare(
      "INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES (?, 'u-B', 'viewer', ?)",
    ).run(T1, T);
  });

  it('내 것만 내려받고, 보기 전용 멤버도 자기 목록은 쓴다', async () => {
    await push(A, [{ table: 'checklistItems', record: check(U('ca'), T1), baseRev: null }]);
    const r = await push(B, [
      { table: 'checklistItems', record: check(U('cb'), T1, { text: '충전기' }), baseRev: null },
    ]);
    expect(r.json().applied).toHaveLength(1);
    const a = await changesOf(A);
    expect(a.map((x) => [x.text, x.ownerId])).toEqual([['여권', 'u-A']]);
    expect((await changesOf(B)).map((x) => x.text)).toEqual(['충전기']);
  });

  it('공유한 준비물만 일행에게, 공유를 끄면 끈 것도 내려가 숨기게, 남의 것은 못 고친다', async () => {
    await push(A, [{ table: 'checklistItems', record: check(U('ca'), T1), baseRev: null }]);
    await push(A, [
      {
        table: 'checklistItems',
        record: check(U('ca'), T1, {
          shared: true,
          sharedAt: T,
          updatedAt: '2026-10-24T00:00:00.000Z',
        }),
        baseRev: 1,
      },
    ]);
    const seen = await changesOf(B);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ text: '여권', shared: true, ownerId: 'u-A' });
    // B가 A의 항목을 고치려 하면 거부
    const r = await push(B, [
      { table: 'checklistItems', record: check(U('ca'), T1, { checked: true }), baseRev: null },
    ]);
    expect(r.json().rejected).toEqual([
      { table: 'checklistItems', id: U('ca'), reason: 'forbidden' },
    ]);
    // 공유 끔 → B에게도 내려간다 (shared: false)
    await push(A, [
      {
        table: 'checklistItems',
        record: check(U('ca'), T1, {
          shared: false,
          sharedAt: T,
          updatedAt: '2026-10-25T00:00:00.000Z',
        }),
        baseRev: null,
      },
    ]);
    expect((await changesOf(B))[0]).toMatchObject({ shared: false });
  });

  it('멤버가 아니면 못 쓴다', async () => {
    const C = userWithSession('C');
    const r = await push(C, [
      { table: 'checklistItems', record: check(U('cc'), T1), baseRev: null },
    ]);
    expect(r.json().rejected).toHaveLength(1);
  });
});
