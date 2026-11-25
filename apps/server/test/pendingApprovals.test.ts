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

const get = (who: string | null) =>
  app.inject({
    method: 'GET',
    url: '/api/me/pending-approvals',
    headers: {
      [PROXY_HEADER]: SECRET,
      origin: ORIGIN,
      ...(who ? { cookie: `__Host-sid=${sid[who]}` } : {}),
    },
  });

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  for (const [id, admin] of [
    ['admin', 1],
    ['owner', 0],
    ['other', 0],
    ['guest', 0],
  ] as const) {
    db.prepare('INSERT INTO users (id, nickname, created_at, is_admin) VALUES (?, ?, ?, ?)').run(
      id,
      `${id}님`,
      'x',
      admin,
    );
    sid[id] = createSession(db, id, 't');
  }
  db.prepare(
    "INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES ('t1', 'owner', 'owner', 'x'), ('t1', 'other', 'editor', 'x')",
  ).run();
  db.prepare(
    "INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, rev) VALUES ('trips', 't1', NULL, 'owner', '{\"title\":\"도쿄\"}', 'x', 1)",
  ).run();
  db.prepare(
    "INSERT INTO trip_join_requests (trip_id, user_id, role, requested_at) VALUES ('t1', 'guest', 'viewer', '2026-11-25')",
  ).run();
  db.prepare(
    "INSERT INTO join_requests (provider, provider_user_id, nickname, requested_at) VALUES ('kakao', '123', '새 사람', '2026-11-25')",
  ).run();
});
afterEach(async () => {
  await app.close();
  db.close();
});

describe('허용·거절할 요청 (2026-11-25, 접속마다 팝업)', () => {
  it('관리자 = 대기 중 가입 요청, 소유자 = 내 여행 참여 요청만 — 다른 멤버·남에게는 안 보인다', async () => {
    expect((await get(null)).statusCode).toBe(401);
    expect((await get('admin')).json()).toEqual({
      joins: [{ id: 'kakao:123', nickname: '새 사람', requestedAt: '2026-11-25' }],
      trips: [],
    });
    expect((await get('owner')).json()).toEqual({
      joins: [],
      trips: [
        {
          tripId: 't1',
          tripTitle: '도쿄',
          userId: 'guest',
          nickname: 'guest님',
          role: 'viewer',
          requestedAt: '2026-11-25',
        },
      ],
    });
    // 같은 여행의 편집자·요청한 사람 본인에게는 없다
    expect((await get('other')).json()).toEqual({ joins: [], trips: [] });
    expect((await get('guest')).json()).toEqual({ joins: [], trips: [] });
  });

  it('거절한 가입 요청은 다시 묻지 않는다', async () => {
    db.prepare("UPDATE join_requests SET status = 'rejected'").run();
    expect((await get('admin')).json()).toEqual({ joins: [], trips: [] });
  });
});
