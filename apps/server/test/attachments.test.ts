import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';
import { purgeEndedTripFiles } from '../src/services/attachments';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
let db: Db;
let app: FastifyInstance;
let dataDir = '';
const sid: Record<string, string> = {};

const record = (table: string, id: string, trip: string | null, data: object) =>
  db
    .prepare(
      'INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, rev) VALUES (?, ?, ?, ?, ?, ?, 1)',
    )
    .run(table, id, trip, 'u-A', JSON.stringify(data), 'x');
const headers = (who: string, extra: Record<string, string> = {}) => ({
  [PROXY_HEADER]: SECRET,
  origin: ORIGIN,
  cookie: `__Host-sid=${sid[who]}`,
  ...extra,
});

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'tp-att-'));
  db = openDb(':memory:');
  app = await buildApp(
    loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET, DATA_DIR: dataDir }),
    db,
  );
  for (const [n, role] of [
    ['A', 'owner'],
    ['V', 'viewer'],
    ['X', null],
  ] as const) {
    db.prepare('INSERT INTO users (id, nickname, created_at) VALUES (?, ?, ?)').run(
      `u-${n}`,
      n,
      'x',
    );
    sid[n] = createSession(db, `u-${n}`, 't');
    if (role)
      db.prepare(
        "INSERT INTO trip_members (trip_id, user_id, role, created_at) VALUES ('t', ?, ?, 'x')",
      ).run(`u-${n}`, role);
  }
  record('trips', 't', null, { endDate: '2099-01-01', timezone: 'Asia/Seoul' });
  record('bookings', 'b', 't', {});
});
afterEach(async () => {
  await app.close();
  db.close();
  rmSync(dataDir, { recursive: true, force: true });
});

const upload = (who: string, body: Buffer, type = 'application/pdf') =>
  app.inject({
    method: 'POST',
    url: '/api/trips/t/bookings/b/attachments',
    headers: headers(who, {
      'content-type': type,
      'x-file-name': encodeURIComponent('이티켓.pdf'),
    }),
    payload: body,
  });

describe('예약 문서 (docs/20 G2)', () => {
  it('올리기·목록·받기·지우기 — 멤버만, 보기 전용은 올리기·지우기 불가, 남은 못 봄', async () => {
    const res = await upload('A', Buffer.from('%PDF-1.4 test'));
    expect(res.statusCode).toBe(200);
    const att = res.json() as { id: string; name: string; size: number };
    expect(att).toMatchObject({ name: '이티켓.pdf', size: 13 });
    expect((await upload('V', Buffer.from('x'))).statusCode).toBe(403);
    expect((await upload('X', Buffer.from('x'))).statusCode).toBe(404);
    const list = await app.inject({
      method: 'GET',
      url: '/api/trips/t/attachments',
      headers: headers('V'),
    });
    expect(list.json().attachments).toHaveLength(1);
    const file = await app.inject({
      method: 'GET',
      url: `/api/attachments/${att.id}`,
      headers: headers('V'),
    });
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.body).toBe('%PDF-1.4 test');
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/attachments/${att.id}`,
          headers: headers('X'),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/attachments/${att.id}`,
          headers: headers('V'),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/attachments/${att.id}`,
          headers: headers('A'),
        })
      ).statusCode,
    ).toBe(200);
    expect(existsSync(join(dataDir, 'attachments', att.id))).toBe(false);
  });

  it('10MB 넘으면 거절, 허용 안 된 형식 거절, 끝난 여행은 받지 않음', async () => {
    expect((await upload('A', Buffer.alloc(10 * 1024 * 1024 + 1))).statusCode).toBe(413);
    expect((await upload('A', Buffer.from('x'), 'text/html')).statusCode).toBe(415);
    db.prepare("UPDATE records SET data_json = ? WHERE id = 't'").run(
      JSON.stringify({ endDate: '2020-01-01', timezone: 'Asia/Seoul' }),
    );
    expect((await upload('A', Buffer.from('%PDF'))).json().error).toBe('trip_ended');
  });

  it('여행이 끝나면 서버 문서를 지운다 (기기에만 남음)', async () => {
    const att = (await upload('A', Buffer.from('%PDF'))).json() as { id: string };
    expect(
      purgeEndedTripFiles(db, join(dataDir, 'attachments'), new Date('2026-10-25T00:00:00Z')),
    ).toBe(0);
    db.prepare("UPDATE records SET data_json = ? WHERE id = 't'").run(
      JSON.stringify({ endDate: '2026-10-24', timezone: 'Asia/Seoul' }),
    );
    expect(
      purgeEndedTripFiles(db, join(dataDir, 'attachments'), new Date('2026-10-25T00:00:00Z')),
    ).toBe(1);
    expect(existsSync(join(dataDir, 'attachments', att.id))).toBe(false);
    expect(db.prepare('SELECT COUNT(*) n FROM attachments').get()).toEqual({ n: 0 });
  });
});
