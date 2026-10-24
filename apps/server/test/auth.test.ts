import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp, PROXY_HEADER } from '../src/app';
import { loadConfig } from '../src/config';
import { openDb, type Db } from '../src/db/database';

const ORIGIN = 'https://trippocket.pages.dev';
const SECRET = 's'.repeat(40);
const env = {
  NODE_ENV: 'test',
  WEB_ORIGIN: ORIGIN,
  PROXY_SECRET: SECRET,
  KAKAO_CLIENT_ID: 'kid',
  KAKAO_CLIENT_SECRET: 'ksecret',
  NAVER_CLIENT_ID: 'nid',
  NAVER_CLIENT_SECRET: 'nsecret',
  GOOGLE_CLIENT_ID: 'gid',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  ALLOWED_ACCOUNTS: 'naver:N-2',
};
const config = loadConfig(env);

let db: Db;
let app: FastifyInstance;
let tokenCalls: { url: string; body: URLSearchParams }[];

/** 제공자 서버 흉내: 코드 → 토큰 → 프로필 */
function mockProviders(profiles: Record<string, unknown>) {
  tokenCalls = [];
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('token')) {
      tokenCalls.push({ url, body: new URLSearchParams(String(init?.body)) });
      return Response.json({ access_token: 'at' });
    }
    for (const [host, body] of Object.entries(profiles))
      if (url.includes(host)) return Response.json(body);
    return new Response('', { status: 404 });
  });
}

const base = { [PROXY_HEADER]: SECRET };
const cookieOf = (res: LightMyRequestResponse, name: string) =>
  res.cookies.find((c) => c.name === name);

/** 시작 → (제공자 로그인은 건너뜀) → 콜백. 세션 쿠키 반환 */
async function login(
  provider: string,
  extraCookie = '',
): Promise<{ res: LightMyRequestResponse; sid: string | undefined }> {
  const start = await app.inject({
    method: 'GET',
    url: `/auth/${provider}/start?returnTo=/trips`,
    headers: base,
  });
  expect(start.statusCode).toBe(302);
  const state = new URL(start.headers.location as string).searchParams.get('state')!;
  const res = await app.inject({
    method: 'GET',
    url: `/auth/${provider}/callback?code=c1&state=${state}`,
    headers: { ...base, cookie: `__Host-oauth=${state}${extraCookie}` },
  });
  return { res, sid: cookieOf(res, '__Host-sid')?.value };
}

const api = (
  method: 'GET' | 'DELETE' | 'POST' | 'PATCH',
  url: string,
  sid?: string,
  payload?: object,
) =>
  app.inject({
    method,
    url,
    headers: { ...base, origin: ORIGIN, ...(sid ? { cookie: `__Host-sid=${sid}` } : {}) },
    ...(payload ? { payload } : {}),
  });

beforeEach(async () => {
  db = openDb(':memory:');
  app = await buildApp(config, db);
  mockProviders({
    'kapi.kakao.com': { id: 1001, kakao_account: { profile: { nickname: '카카오님' } } },
    'openapi.naver.com': { response: { id: 'N-2', nickname: '네이버님' } },
    'openidconnect.googleapis.com': { sub: 'G-3', name: 'Google User' },
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  db.close();
});

describe('로그인', () => {
  it('카카오: 시작 주소에 state·콜백 주소, 콜백에서 시크릿으로 교환 → 세션 쿠키 → 앱으로', async () => {
    const start = await app.inject({ method: 'GET', url: '/auth/kakao/start', headers: base });
    const to = new URL(start.headers.location as string);
    expect(to.origin + to.pathname).toBe('https://kauth.kakao.com/oauth/authorize');
    expect(to.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/auth/kakao/callback`);
    expect(to.searchParams.get('code_challenge')).toBeNull();
    expect(cookieOf(start, '__Host-oauth')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    });

    const { res, sid } = await login('kakao');
    expect(res.headers.location).toBe(`${ORIGIN}/trips`);
    expect(tokenCalls[0]!.body.get('client_secret')).toBe('ksecret');
    expect(cookieOf(res, '__Host-sid')).toMatchObject({ httpOnly: true, secure: true, path: '/' });
    const me = await api('GET', '/api/me', sid);
    expect(me.json()).toMatchObject({
      nickname: '카카오님',
      providers: ['kakao'],
      nicknameSet: false,
    });
    // DB에는 세션 토큰이 아니라 해시만
    const row = db.prepare('SELECT id_hash FROM sessions').get() as { id_hash: string };
    expect(row.id_hash).not.toBe(sid);
  });

  it('닉네임 바꾸기: 다듬어 저장하고 "정함"으로 표시, 잘못된 값은 400, 로그인 필요', async () => {
    const { sid } = await login('kakao');
    const res = await api('PATCH', '/api/me/nickname', sid, { nickname: '  진하  ' });
    expect(res.json()).toEqual({ nickname: '진하' });
    expect((await api('GET', '/api/me', sid)).json()).toMatchObject({
      nickname: '진하',
      nicknameSet: true,
    });
    expect((await api('PATCH', '/api/me/nickname', sid, { nickname: ' ' })).statusCode).toBe(400);
    expect(
      (await api('PATCH', '/api/me/nickname', sid, { nickname: '가'.repeat(21) })).statusCode,
    ).toBe(400);
    expect((await api('PATCH', '/api/me/nickname', undefined, { nickname: 'x' })).statusCode).toBe(
      401,
    );
  });

  it('구글은 PKCE (code_challenge → code_verifier)', async () => {
    const start = await app.inject({ method: 'GET', url: '/auth/google/start', headers: base });
    const to = new URL(start.headers.location as string);
    expect(to.searchParams.get('code_challenge_method')).toBe('S256');
    await login('kakao'); // 첫 계정(초대제) 먼저
    const { sid } = await login('google');
    expect(tokenCalls.at(-1)!.body.get('code_verifier')).toBeTruthy();
    expect(sid).toBeUndefined(); // 허용 목록에 없음
  });

  it('state가 없거나 다르거나 이미 쓴 것이면 거부, 브라우저 쿠키와도 맞아야 함', async () => {
    const start = await app.inject({ method: 'GET', url: '/auth/kakao/start', headers: base });
    const state = new URL(start.headers.location as string).searchParams.get('state')!;
    const noCookie = await app.inject({
      method: 'GET',
      url: `/auth/kakao/callback?code=c&state=${state}`,
      headers: base,
    });
    expect(noCookie.headers.location).toBe(`${ORIGIN}/login?error=state`);
    // 쿠키 없이 실패한 state는 이미 지워져 재사용 불가 — 새로 시작해야 함
    const reuse = await app.inject({
      method: 'GET',
      url: `/auth/kakao/callback?code=c&state=${state}`,
      headers: { ...base, cookie: `__Host-oauth=${state}` },
    });
    expect(reuse.headers.location).toBe(`${ORIGIN}/login?error=state`);
  });

  it('돌아갈 주소는 앱 안 경로만 (열린 리다이렉트 방지)', async () => {
    const start = await app.inject({
      method: 'GET',
      url: '/auth/kakao/start?returnTo=//evil.example',
      headers: base,
    });
    const state = new URL(start.headers.location as string).searchParams.get('state')!;
    const res = await app.inject({
      method: 'GET',
      url: `/auth/kakao/callback?code=c&state=${state}`,
      headers: { ...base, cookie: `__Host-oauth=${state}` },
    });
    expect(res.headers.location).toBe(`${ORIGIN}/me`);
  });

  it('초대제: 첫 계정은 가입(관리자), 그다음은 허용 목록에 있거나 승인 대기', async () => {
    const owner = await login('kakao');
    expect(owner.sid).toBeTruthy();
    expect((await api('GET', '/api/me', owner.sid)).json()).toMatchObject({ isAdmin: true });
    const denied = await login('google');
    expect(denied.sid).toBeUndefined();
    expect(denied.res.headers.location).toBe(`${ORIGIN}/login?error=pending`);
    const naver = await login('naver'); // ALLOWED_ACCOUNTS=naver:N-2
    expect(naver.sid).toBeTruthy();
    expect((await api('GET', '/api/me', naver.sid)).json()).not.toHaveProperty('isAdmin');
  });

  it('켜지지 않은 제공자는 로그인 화면으로', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/facebook/start', headers: base });
    expect(res.headers.location).toBe(`${ORIGIN}/login?error=provider`);
    const list = await app.inject({ method: 'GET', url: '/auth/providers', headers: base });
    expect(list.json()).toEqual({ providers: ['kakao', 'naver', 'google'] });
  });
});

describe('사용자 관리 (관리자 승인)', () => {
  type AdminList = {
    requests: { id: string; nickname: string; status: string; provider: string }[];
    users: { id: string; nickname: string; status: string; isAdmin: boolean }[];
  };
  const list = async (sid?: string) =>
    (await api('GET', '/api/admin/users', sid)).json() as AdminList;

  it('가입 요청 → 관리자 승인 → 그 사람이 다시 로그인하면 사용', async () => {
    const owner = await login('kakao');
    await login('google');
    await login('google'); // 같은 사람이 여러 번 눌러도 요청은 하나
    const { requests } = await list(owner.sid);
    expect(requests).toEqual([
      expect.objectContaining({ id: 'google:G-3', nickname: 'Google User', status: 'pending' }),
    ]);
    const ok = await api('POST', '/api/admin/requests/google%3AG-3/approve', owner.sid);
    expect(ok.statusCode).toBe(200);
    const after = await login('google');
    expect(after.sid).toBeTruthy();
    expect((await list(owner.sid)).requests).toEqual([]);
  });

  it('거절하면 다시 로그인해도 거절 안내, 나중에 승인할 수도 있다', async () => {
    const owner = await login('kakao');
    await login('google');
    await api('POST', '/api/admin/requests/google%3AG-3/reject', owner.sid);
    const again = await login('google');
    expect(again.sid).toBeUndefined();
    expect(again.res.headers.location).toBe(`${ORIGIN}/login?error=rejected`);
    expect((await list(owner.sid)).requests[0]!.status).toBe('rejected');
    await api('POST', '/api/admin/requests/google%3AG-3/approve', owner.sid);
    expect((await login('google')).sid).toBeTruthy();
  });

  it('사용 중지: 바로 로그아웃되고 다시 로그인 불가, 다시 허용하면 사용', async () => {
    const owner = await login('kakao');
    const member = await login('naver');
    const memberId = (await api('GET', '/api/me', member.sid)).json().id as string;
    await api('POST', `/api/admin/users/${memberId}/disable`, owner.sid);
    expect((await api('GET', '/api/me', member.sid)).statusCode).toBe(401);
    const blocked = await login('naver');
    expect(blocked.sid).toBeUndefined();
    expect(blocked.res.headers.location).toBe(`${ORIGIN}/login?error=disabled`);
    await api('POST', `/api/admin/users/${memberId}/enable`, owner.sid);
    expect((await login('naver')).sid).toBeTruthy();
  });

  it('관리자가 아니면 403, 로그인 안 했으면 401, 관리자 자신은 중지 불가', async () => {
    const owner = await login('kakao');
    const member = await login('naver');
    expect((await api('GET', '/api/admin/users')).statusCode).toBe(401);
    expect((await api('GET', '/api/admin/users', member.sid)).statusCode).toBe(403);
    const ownerId = (await api('GET', '/api/me', owner.sid)).json().id as string;
    expect((await api('POST', `/api/admin/users/${ownerId}/disable`, member.sid)).statusCode).toBe(
      403,
    );
    expect((await api('POST', `/api/admin/users/${ownerId}/disable`, owner.sid)).statusCode).toBe(
      400,
    );
    expect((await api('POST', '/api/admin/requests/nope/approve', owner.sid)).statusCode).toBe(404);
  });

  it('관리자가 탈퇴하면 다음으로 오래된 계정이 관리자를 이어받는다', async () => {
    const owner = await login('kakao');
    const member = await login('naver');
    await api('DELETE', '/api/me', owner.sid);
    expect((await api('GET', '/api/me', member.sid)).json()).toMatchObject({ isAdmin: true });
  });
});

describe('세션·내 정보 (인가)', () => {
  it('로그인 안 했으면 401, 만료된 세션도 401', async () => {
    expect((await api('GET', '/api/me')).statusCode).toBe(401);
    const { sid } = await login('kakao');
    db.prepare('UPDATE sessions SET expires_at = ?').run('2000-01-01T00:00:00.000Z');
    expect((await api('GET', '/api/me', sid)).statusCode).toBe(401);
  });

  it('로그인할 때마다 새 세션 ID (세션 고정 방지), 로그아웃하면 끝', async () => {
    const a = await login('kakao');
    const b = await login('kakao', `; __Host-sid=${a.sid}`);
    expect(b.sid).not.toBe(a.sid);
    expect((await api('GET', '/api/me', a.sid)).statusCode).toBe(401);
    expect((await api('POST', '/auth/logout', b.sid)).statusCode).toBe(200);
    expect((await api('GET', '/api/me', b.sid)).statusCode).toBe(401);
  });

  it('기기 목록·끊기는 내 세션만 — 남의 세션 id로는 404', async () => {
    const mine = await login('kakao');
    const other = await login('naver');
    const list = (await api('GET', '/api/me/sessions', mine.sid)).json() as {
      sessions: { id: string; current: boolean }[];
    };
    expect(list.sessions).toHaveLength(1);
    expect(list.sessions[0]!.current).toBe(true);
    const otherId = (
      (await api('GET', '/api/me/sessions', other.sid)).json() as { sessions: { id: string }[] }
    ).sessions[0]!.id;
    expect((await api('DELETE', `/api/me/sessions/${otherId}`, mine.sid)).statusCode).toBe(404);
    expect((await api('GET', '/api/me', other.sid)).statusCode).toBe(200);
  });

  it('탈퇴하면 계정·세션·서버 데이터가 지워진다', async () => {
    const { sid } = await login('kakao');
    const me = (await api('GET', '/api/me', sid)).json() as { id: string };
    db.prepare(
      "INSERT INTO records (table_name, id, owner_user_id, data_json, updated_at, rev) VALUES ('trips', 't1', ?, '{}', 'x', 1)",
    ).run(me.id);
    expect((await api('DELETE', '/api/me', sid)).statusCode).toBe(200);
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM records').get()).toEqual({ n: 0 });
    expect((await api('GET', '/api/me', sid)).statusCode).toBe(401);
  });
});

describe('주소 옮기는 동안 (웹앱 주소 여러 개)', () => {
  it('들어온 주소로 콜백·돌아가기, 목록에 없는 주소는 기본 주소, Origin 검사는 둘 다 허용', async () => {
    await app.close();
    app = await buildApp(
      loadConfig({ ...env, WEB_ORIGIN: `https://trippocket.day,${ORIGIN}` }),
      db,
    );
    const start = (origin?: string) =>
      app.inject({
        method: 'GET',
        url: '/auth/kakao/start',
        headers: { ...base, ...(origin ? { 'x-tp-origin': origin } : {}) },
      });
    const redirect = async (origin?: string) =>
      new URL((await start(origin)).headers.location as string).searchParams.get('redirect_uri');
    expect(await redirect(ORIGIN)).toBe(`${ORIGIN}/auth/kakao/callback`);
    expect(await redirect('https://evil.example')).toBe(
      'https://trippocket.day/auth/kakao/callback',
    );
    expect(await redirect()).toBe('https://trippocket.day/auth/kakao/callback');
    for (const origin of ['https://trippocket.day', ORIGIN]) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { ...base, origin },
      });
      expect(res.statusCode).toBe(200);
    }
    const bad = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { ...base, origin: 'https://evil.example' },
    });
    expect(bad.statusCode).toBe(403);
  });
});
