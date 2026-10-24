import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET });

let db: Db;
let app: FastifyInstance;
const sid: Record<string, string> = {};

const call = (
  who: string | null,
  method: 'GET' | 'PUT' | 'DELETE' | 'PATCH' | 'POST',
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

const record = (table: string, id: string, trip: string | null, data: object) =>
  db
    .prepare(
      'INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, rev) VALUES (?, ?, ?, ?, ?, ?, 1)',
    )
    .run(table, id, trip, 'u-A', JSON.stringify(data), 'x');

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  ['A', 'B', 'V', 'X'].forEach((n, i) => {
    db.prepare('INSERT INTO users (id, nickname, created_at) VALUES (?, ?, ?)').run(
      `u-${n}`,
      `닉${n}`,
      `2026-01-0${i + 1}`,
    );
    sid[n] = createSession(db, `u-${n}`, 't');
  });
  // A 소유 여행에 B 편집자, V 보기 전용. X는 남
  for (const [u, role] of [
    ['u-A', 'owner'],
    ['u-B', 'editor'],
    ['u-V', 'viewer'],
  ] as const)
    db.prepare(
      'INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
    ).run('t1', u, role, 'x');
  record('trips', 't1', null, { timezone: 'Asia/Seoul' });
  record('items', 'past', 't1', { date: '2020-01-01' });
  record('items', 'past2', 't1', { date: '2020-01-02' });
  record('items', 'future', 't1', { date: '2099-01-01' });
});
afterEach(async () => {
  await app.close();
  db.close();
});

const body = (o: object = {}) => ({
  tripId: 't1',
  itemId: 'past',
  kind: 'food',
  placeKey: 'g:ChIJabcd',
  placeName: '이치란',
  ratings: { overall: 5, taste: 4 },
  note: '맛있어요',
  ...o,
});

describe('후기·포인트 (docs/17)', () => {
  it('장소에 연결된 후기 = +100P, 같은 장소는 한 번, 고쳐도 그대로, 지우면 회수', async () => {
    const res = await call('A', 'PUT', '/api/reviews', body());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      pointsAwarded: 100,
      balance: 100,
      review: { author: '닉A', mine: true },
    });
    // 고치기 — 추가 포인트 없음
    const again = await call('A', 'PUT', '/api/reviews', body({ ratings: { overall: 3 } }));
    expect(again.json()).toMatchObject({
      pointsAwarded: 0,
      balance: 100,
      review: { ratings: { overall: 3 } },
    });
    // 다른 일정이라도 같은 장소면 포인트 없음
    expect(
      (await call('A', 'PUT', '/api/reviews', body({ itemId: 'past2' }))).json().pointsAwarded,
    ).toBe(0);
    const id = again.json().review.id as string;
    expect((await call('A', 'DELETE', `/api/reviews/${id}`)).json().balance).toBe(0);
    expect(
      (await call('A', 'GET', '/api/me/points'))
        .json()
        .history.map((h: { delta: number }) => h.delta),
    ).toEqual([-100, 100]);
  });

  it('연결 안 된(직접 입력) 후기는 포인트 없음 → 나중에 장소를 연결하면 그때 +100P', async () => {
    expect((await call('A', 'PUT', '/api/reviews', body({ placeKey: null }))).json()).toMatchObject(
      { pointsAwarded: 0, balance: 0 },
    );
    expect((await call('A', 'PUT', '/api/reviews', body())).json()).toMatchObject({
      pointsAwarded: 100,
      balance: 100,
    });
  });

  it('보기 전용 멤버·남은 못 쓰고, 다녀오기 전 일정·동기화 안 된 일정도 안 됨, 이상한 입력 400', async () => {
    expect((await call('V', 'PUT', '/api/reviews', body())).statusCode).toBe(403);
    expect((await call('X', 'PUT', '/api/reviews', body())).statusCode).toBe(404);
    expect((await call(null, 'PUT', '/api/reviews', body())).statusCode).toBe(401);
    expect((await call('A', 'PUT', '/api/reviews', body({ itemId: 'future' }))).json().error).toBe(
      'not_visited',
    );
    expect((await call('A', 'PUT', '/api/reviews', body({ itemId: 'nope' }))).statusCode).toBe(409);
    expect(
      (await call('A', 'PUT', '/api/reviews', body({ ratings: { taste: 4 } }))).statusCode,
    ).toBe(400);
  });

  it('공개 범위: 같은 장소 후기는 다른 여행 멤버도 보고, 연결 안 된 후기는 그 여행 멤버만. 남의 여행 id로는 못 봄', async () => {
    await call('A', 'PUT', '/api/reviews', body());
    await call(
      'B',
      'PUT',
      '/api/reviews',
      body({ itemId: 'past2', placeKey: null, placeName: '그냥 식당' }),
    );
    // X의 여행에서 같은 장소를 본다
    db.prepare(
      "INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES ('t2', 'u-X', 'owner', 'x')",
    ).run();
    const other = (await call('X', 'GET', '/api/reviews?trip=t2&item=z&place=g:ChIJabcd')).json();
    expect(other.reviews.map((r: { author: string }) => r.author)).toEqual(['닉A']);
    expect(other.summary).toEqual({ count: 1, averages: { overall: 5, taste: 4 } });
    // 같은 여행 멤버는 연결 안 된 후기도
    const member = (await call('V', 'GET', '/api/reviews?trip=t1&item=past2')).json();
    expect(member.reviews.map((r: { placeName: string }) => r.placeName)).toEqual(['그냥 식당']);
    expect((await call('X', 'GET', '/api/reviews?trip=t1&item=past2')).statusCode).toBe(404);
  });

  it('닉네임 가리기 → User#N (이미 쓴 후기에도), 탈퇴해도 후기는 남고 User#N', async () => {
    await call('B', 'PUT', '/api/reviews', body());
    const me = (await call('B', 'GET', '/api/me')).json();
    expect(me).toMatchObject({ publicNo: 2, hideNickname: false, points: 100 });
    await call('B', 'PATCH', '/api/me/privacy', { hideNickname: true });
    const seen = () => call('A', 'GET', '/api/reviews?trip=t1&item=past&place=g:ChIJabcd');
    expect((await seen()).json().reviews[0].author).toBe('User#2');
    await call('B', 'PATCH', '/api/me/privacy', { hideNickname: false });
    expect((await call('B', 'DELETE', '/api/me')).statusCode).toBe(200);
    const after = (await seen()).json();
    expect(after.reviews).toHaveLength(1);
    expect(after.reviews[0]).toMatchObject({ author: 'User#2', mine: false });
    expect(db.prepare('SELECT COUNT(*) n FROM point_ledger').get()).toEqual({ n: 0 });
  });

  it('하루 10건까지만 포인트 (쓰기 자체도 분당 10회 제한)', async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 10; i++)
      db.prepare(
        "INSERT INTO point_ledger (user_id, delta, reason, place_key, created_at) VALUES ('u-A', 100, 'review', ?, ?)",
      ).run(`k:9${i}`, now);
    const r = (await call('A', 'PUT', '/api/reviews', body())).json();
    expect(r).toMatchObject({ pointsAwarded: 0, balance: 1000 });
  });

  it('관리자 숨김: 목록에서 빠지고 포인트 회수', async () => {
    db.prepare("UPDATE users SET is_admin = 1 WHERE id = 'u-A'").run();
    const id = (await call('B', 'PUT', '/api/reviews', body())).json().review.id as string;
    expect(
      (await call('B', 'POST', `/api/admin/reviews/${id}/hidden`, { hidden: true })).statusCode,
    ).toBe(403);
    expect(
      (await call('A', 'POST', `/api/admin/reviews/${id}/hidden`, { hidden: true })).statusCode,
    ).toBe(200);
    expect(
      (await call('A', 'GET', '/api/reviews?trip=t1&item=x&place=g:ChIJabcd')).json().reviews,
    ).toEqual([]);
    expect((await call('B', 'GET', '/api/me/points')).json().balance).toBe(0);
  });
});
