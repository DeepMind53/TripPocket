import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { planAlertPushes } from '../src/services/alertPush';
import { resetAlertCache } from '../src/services/alerts';
import { planPushes } from '../src/services/pushScheduler';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
let db: Db;
let app: FastifyInstance;
let sid = '';

const call = (method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: object, auth = true) =>
  app.inject({
    method,
    url,
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(auth ? { cookie: `__Host-sid=${sid}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });
const record = (table: string, id: string, trip: string | null, data: object) =>
  db
    .prepare(
      'INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, rev) VALUES (?, ?, ?, ?, ?, ?, 1)',
    )
    .run(table, id, trip, 'u', JSON.stringify(data), 'x');

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(
    loadConfig({
      NODE_ENV: 'test',
      WEB_ORIGIN: ORIGIN,
      PROXY_SECRET: SECRET,
      VAPID_PUBLIC_KEY: 'pub-key-123',
    }),
    db,
  );
  db.prepare("INSERT INTO users (id, nickname, created_at) VALUES ('u', 'u', 'x')").run();
  sid = createSession(db, 'u', 't');
});
afterEach(async () => {
  await app.close();
  db.close();
});

const sub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'BKey_1234567890abc', auth: 'auth_123456789' },
};

describe('알림 (docs/20 G1)', () => {
  it('구독 등록·종류 바꾸기·끄기, 로그인 필요, 이상한 값 400', async () => {
    expect((await call('GET', '/api/push/key')).json()).toEqual({ key: 'pub-key-123' });
    expect((await call('PUT', '/api/push/subscription', sub, false)).statusCode).toBe(401);
    expect(
      (await call('PUT', '/api/push/subscription', { ...sub, endpoint: 'http://x' })).statusCode,
    ).toBe(400);
    const res = await call('PUT', '/api/push/subscription', { ...sub, prefs: { itemSoon: false } });
    expect(res.json().prefs).toEqual({
      departure: true,
      entry: true,
      itemSoon: false,
      sharing: true,
      alert: true,
    });
    await call('PUT', '/api/push/subscription', { ...sub, prefs: { itemSoon: true } });
    expect(db.prepare('SELECT COUNT(*) n FROM push_subscriptions').get()).toEqual({ n: 1 });
    await call('DELETE', '/api/push/subscription', { endpoint: sub.endpoint });
    expect(db.prepare('SELECT COUNT(*) n FROM push_subscriptions').get()).toEqual({ n: 0 });
  });

  it('보낼 알림 계산: 출발 하루 전·입국신고 기간(체크 안 한 것만)·30분 전 일정', async () => {
    await call('PUT', '/api/push/subscription', sub);
    db.prepare(
      "INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES ('t', 'u', 'owner', 'x')",
    ).run();
    // 지금 = 방콕 2026-10-31 10:40 → 내일 출발, TDAC(3일 전부터) 대상
    const now = new Date('2026-10-31T03:40:00Z');
    record('trips', 't', null, {
      id: 't',
      title: '방콕',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      timezone: 'Asia/Bangkok',
      destinations: [{ countryCode: 'TH' }],
    });
    let plan = planPushes(db, now);
    expect(plan.map((p) => p.key).sort()).toEqual(['dep:t:2026-11-01', 'entry:t:TH:arrival']);
    // TDAC를 체크하면 빠진다
    record('checklistItems', 'c', 't', { list: 'essentials', text: 'TH:arrival', checked: true });
    plan = planPushes(db, now);
    expect(plan.map((p) => p.kind)).toEqual(['departure']);
    // 여행 당일 11:10 시작 일정 → 10:40에 30분 전 알림
    const day = new Date('2026-11-01T03:40:00Z');
    record('items', 'i', 't', { id: 'i', date: '2026-11-01', title: '왓포', startTime: '11:10' });
    record('items', 'j', 't', { id: 'j', date: '2026-11-01', title: '저녁', startTime: '19:00' });
    plan = planPushes(db, day);
    expect(plan.filter((p) => p.kind === 'itemSoon').map((p) => p.msg.title)).toEqual([
      '11:10 왓포',
    ]);
  });
});

describe('여행지 특보 알림 (docs/24, ADR-0008)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('출발 7일 전부터 빨강 특보가 새로 생기면 1번, 같은 것은 다시 알리지 않는다', async () => {
    resetAlertCache();
    let level = 'Red';
    vi.stubGlobal('fetch', async (input: string | URL) => {
      const url = String(input);
      if (url.includes('gdacs'))
        return Response.json({
          features: [
            {
              properties: {
                eventtype: 'TC',
                eventid: 7,
                name: 'Tropical Cyclone X',
                alertlevel: level,
                iscurrent: 'true',
                affectedcountries: [{ iso2: 'JP' }],
              },
            },
          ],
        });
      return Response.json({ features: [] });
    });
    await call('PUT', '/api/push/subscription', sub);
    db.prepare(
      "INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES ('t', 'u', 'owner', 'x')",
    ).run();
    record('trips', 't', null, {
      id: 't',
      title: '도쿄',
      startDate: '2026-11-05',
      endDate: '2026-11-07',
      timezone: 'Asia/Tokyo',
      destinations: [{ countryCode: 'JP' }],
    });
    // 출발 8일 전: 아직
    expect(await planAlertPushes(db, {}, new Date('2026-10-28T03:00:00Z'))).toEqual([]);
    const now = new Date('2026-10-30T03:00:00Z');
    const plan = await planAlertPushes(db, {}, now);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'alert', key: 'alertday:t:2026-10-30' });
    expect(plan[0]!.msg.body).toContain('태풍 빨강 경보');
    expect(plan[0]!.msg.url).toBe('/trips/t/weather');
    // 같은 특보는 다음 날에도 다시 알리지 않는다
    resetAlertCache();
    expect(await planAlertPushes(db, {}, new Date('2026-10-31T03:00:00Z'))).toEqual([]);
    // 주황은 알리지 않는다
    level = 'Orange';
    resetAlertCache();
    db.prepare('DELETE FROM push_sent').run();
    expect(await planAlertPushes(db, {}, now)).toEqual([]);
  });
});
