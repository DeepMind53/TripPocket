import type { FastifyInstance } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { createSession } from '../src/auth/session';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';

const SECRET = 's'.repeat(40);
const ORIGIN = 'https://a.dev';
const config = loadConfig({ NODE_ENV: 'test', WEB_ORIGIN: ORIGIN, PROXY_SECRET: SECRET });
const T = '2026-10-23T00:00:00.000Z';
const U = (n: string) =>
  `00000000-0000-7000-8000-${Buffer.from(n).toString('hex').padStart(12, '0').slice(-12)}`;
const TRIP = U('t1');

let db: Db;
let app: FastifyInstance;
const sid: Record<string, string> = {};

const call = (
  who: string | null,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
  for (const n of ['A', 'B', 'C']) {
    db.prepare('INSERT INTO users (id, nickname, created_at) VALUES (?, ?, ?)').run(`u-${n}`, n, T);
    sid[n] = createSession(db, `u-${n}`, 't');
  }
  // A의 여행 + 일정(메모) + 숙소 예약(예약번호·전화)
  const push = await call('A', 'POST', '/api/sync/push', {
    changes: [
      {
        table: 'trips',
        baseRev: null,
        record: {
          id: TRIP,
          title: '도쿄',
          destinations: [],
          startDate: '2026-11-01',
          endDate: '2026-11-02',
          timezone: 'Asia/Tokyo',
          cover: {},
          memo: '비밀',
          createdAt: T,
          updatedAt: T,
        },
      },
      {
        table: 'items',
        baseRev: null,
        record: {
          id: U('i1'),
          tripId: TRIP,
          date: '2026-11-01',
          order: 'a0',
          kind: 'place',
          title: '센소지',
          memo: '개인 메모',
          createdAt: T,
          updatedAt: T,
        },
      },
      {
        table: 'bookings',
        baseRev: null,
        record: {
          id: U('b1'),
          tripId: TRIP,
          kind: 'lodging',
          title: '호텔',
          confirmationNo: 'ABC123',
          start: { date: '2026-11-01' },
          details: { phone: '010-1234', address: '신주쿠' },
          createdAt: T,
          updatedAt: T,
        },
      },
    ],
  });
  expect(push.json().applied).toHaveLength(3);
});
afterEach(async () => {
  await app.close();
  db.close();
});

describe('보기 전용 링크', () => {
  it('로그인 없이 볼 수 있고, 기본은 예약번호·연락처·메모를 뺀다', async () => {
    const { share } = (
      await call('A', 'POST', `/api/trips/${TRIP}/share`, { includeSensitive: false })
    ).json();
    expect(share.id).toMatch(/^[\w-]{20,}$/);
    const view = (await call(null, 'GET', `/api/public/shares/${share.id}`)).json();
    expect(view.trip.title).toBe('도쿄');
    expect(JSON.stringify(view)).not.toMatch(/ABC123|010-1234|개인 메모|비밀/);
    expect(view.bookings[0].details.address).toBe('신주쿠');
  });

  it('끄면 바로 404, 새로 만들면 예전 링크는 꺼진다', async () => {
    const first = (
      await call('A', 'POST', `/api/trips/${TRIP}/share`, { includeSensitive: true })
    ).json().share.id;
    const second = (
      await call('A', 'POST', `/api/trips/${TRIP}/share`, { includeSensitive: false })
    ).json().share.id;
    expect((await call(null, 'GET', `/api/public/shares/${first}`)).statusCode).toBe(404);
    expect((await call(null, 'GET', `/api/public/shares/${second}`)).statusCode).toBe(200);
    await call('A', 'DELETE', `/api/trips/${TRIP}/share`);
    expect((await call(null, 'GET', `/api/public/shares/${second}`)).statusCode).toBe(404);
  });

  it('멤버가 아니면 링크를 만들거나 볼 수 없다 (404)', async () => {
    expect(
      (await call('B', 'POST', `/api/trips/${TRIP}/share`, { includeSensitive: true })).statusCode,
    ).toBe(404);
    expect((await call('B', 'GET', `/api/trips/${TRIP}/share`)).statusCode).toBe(404);
  });
});

describe('초대·멤버', () => {
  it('초대 수락 → 멤버가 되고 동기화로 여행을 받는다, 소유자만 초대', async () => {
    expect(
      (await call('B', 'POST', `/api/trips/${TRIP}/invites`, { role: 'editor' })).statusCode,
    ).toBe(404);
    const { token } = (
      await call('A', 'POST', `/api/trips/${TRIP}/invites`, { role: 'editor' })
    ).json();
    const accept = await call('B', 'POST', `/api/invites/${token}/accept`);
    expect(accept.json()).toEqual({ tripId: TRIP, role: 'editor' });
    const pulled = (await call('B', 'GET', '/api/sync/pull?since=0')).json();
    // 내 역할도 함께 (앱이 보기 전용 여행의 수정을 막는 데 씀)
    expect(pulled.roles).toEqual({ [TRIP]: 'editor' });
    expect(pulled.changes.map((c: { table: string }) => c.table).sort()).toEqual([
      'bookings',
      'items',
      'trips',
    ]);
    const members = (await call('B', 'GET', `/api/trips/${TRIP}/members`)).json().members;
    expect(members.map((m: { nickname: string; role: string }) => [m.nickname, m.role])).toEqual([
      ['A', 'owner'],
      ['B', 'editor'],
    ]);
  });

  it('만료되거나 다 쓴 초대는 410, 엉터리 토큰도 410', async () => {
    const { token } = (
      await call('A', 'POST', `/api/trips/${TRIP}/invites`, { role: 'viewer' })
    ).json();
    db.prepare('UPDATE invites SET expires_at = ?').run('2000-01-01T00:00:00.000Z');
    expect((await call('B', 'POST', `/api/invites/${token}/accept`)).statusCode).toBe(410);
    expect((await call('B', 'POST', '/api/invites/nope/accept')).statusCode).toBe(410);
  });

  it('역할 변경·내보내기는 소유자만, 멤버는 스스로 나갈 수 있고 소유자는 못 나간다', async () => {
    const { token } = (
      await call('A', 'POST', `/api/trips/${TRIP}/invites`, { role: 'viewer' })
    ).json();
    await call('B', 'POST', `/api/invites/${token}/accept`);
    await call('C', 'POST', `/api/invites/${token}/accept`);
    expect(
      (await call('B', 'PATCH', `/api/trips/${TRIP}/members/u-C`, { role: 'editor' })).statusCode,
    ).toBe(404);
    expect(
      (await call('A', 'PATCH', `/api/trips/${TRIP}/members/u-C`, { role: 'editor' })).statusCode,
    ).toBe(200);
    expect((await call('B', 'DELETE', `/api/trips/${TRIP}/members/u-C`)).statusCode).toBe(404);
    expect((await call('C', 'DELETE', `/api/trips/${TRIP}/members/u-C`)).statusCode).toBe(200);
    expect((await call('A', 'DELETE', `/api/trips/${TRIP}/members/u-A`)).statusCode).toBe(404);
    expect((await call('A', 'DELETE', `/api/trips/${TRIP}/members/u-B`)).statusCode).toBe(200);
    expect((await call('B', 'GET', '/api/sync/pull?since=0')).json().changes).toEqual([]);
  });
});
