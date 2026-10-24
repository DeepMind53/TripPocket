import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from '@trippocket/shared';
import { requestOrigin, type Config } from '../config';
import type { Db } from '../db/database';
import { fixedAdmins, syncAdmins } from '../auth/admins';
import { trackApi } from '../services/apiUsage';
import {
  credentialsFor,
  exchangeCode,
  PROVIDERS,
  redirectUri,
  SPECS,
  type Profile,
  type ProviderId,
} from '../auth/providers';
import {
  cookieOptions,
  createSession,
  randomToken,
  readSession,
  SESSION_COOKIE,
  sha256,
} from '../auth/session';

const STATE_COOKIE = '__Host-oauth';
const STATE_TTL = 10 * 60_000;
const SESSION_MAX = 90 * 86_400_000;

/** 로그인 후 돌아갈 앱 경로 — 같은 앱 안의 경로만 (열린 리다이렉트 방지) */
function safeReturn(v: unknown): string {
  return typeof v === 'string' && /^\/(?!\/)[\w\-/?=&.%]*$/.test(v) ? v : '/me';
}

const isProvider = (p: string): p is ProviderId => (PROVIDERS as readonly string[]).includes(p);

/** 가입 정책 (docs/08 G1, 기본 초대제): 첫 계정은 허용, 그다음은 허용 목록(ALLOWED_ACCOUNTS)에 있거나 관리자가 승인해야 */
function mayJoin(db: Db, config: Config, provider: ProviderId, profile: Profile): boolean {
  if (config.SIGNUP === 'open') return true;
  const users = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (users === 0) return true;
  const allowed = (config.ALLOWED_ACCOUNTS ?? '').split(',').map((s) => s.trim());
  return allowed.includes(`${provider}:${profile.providerUserId}`);
}

/** 가입 요청 남기기 → 로그인 화면에 보여 줄 상태. 거절된 계정은 다시 쌓이지 않는다 */
const MAX_PENDING = 50;
function requestJoin(db: Db, provider: string, providerUserId: string, nickname: string) {
  const row = db
    .prepare('SELECT status FROM join_requests WHERE provider = ? AND provider_user_id = ?')
    .get(provider, providerUserId) as { status: string } | undefined;
  if (row?.status === 'rejected') return 'rejected';
  if (row) {
    db.prepare(
      'UPDATE join_requests SET nickname = ? WHERE provider = ? AND provider_user_id = ?',
    ).run(nickname, provider, providerUserId);
    return 'pending';
  }
  // 아무나 로그인 버튼을 눌러 목록을 채우지 못하게 대기 수 상한
  const pending = db
    .prepare("SELECT COUNT(*) AS n FROM join_requests WHERE status = 'pending'")
    .get() as { n: number };
  if (pending.n >= MAX_PENDING) return 'invite';
  db.prepare(
    'INSERT INTO join_requests (provider, provider_user_id, nickname, requested_at) VALUES (?, ?, ?, ?)',
  ).run(provider, providerUserId, nickname, new Date().toISOString());
  return 'pending';
}

export function audit(db: Db, userId: string | null, action: string, target?: string) {
  db.prepare('INSERT INTO audit_log (user_id, action, target, created_at) VALUES (?, ?, ?, ?)').run(
    userId,
    action,
    target ?? null,
    new Date().toISOString(),
  );
}

export function authRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const fail = (origin: string, code: string, extra = '') =>
    `${origin}/login?error=${code}${extra}`;

  // 1) 시작: state(+구글은 PKCE) 만들고 제공자 로그인 화면으로
  app.get<{ Params: { provider: string }; Querystring: { returnTo?: string } }>(
    '/auth/:provider/start',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const p = req.params.provider;
      const origin = requestOrigin(config, req.headers);
      const creds = isProvider(p) ? credentialsFor(config, p) : null;
      if (!isProvider(p) || !creds) return reply.redirect(fail(origin, 'provider'));
      const spec = SPECS[p];
      const state = randomToken(24);
      const verifier = spec.pkce ? randomToken(48) : null;
      db.prepare('DELETE FROM oauth_states WHERE created_at < ?').run(
        new Date(Date.now() - STATE_TTL).toISOString(),
      );
      db.prepare(
        'INSERT INTO oauth_states (state_hash, provider, code_verifier, return_to, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(sha256(state), p, verifier, safeReturn(req.query.returnTo), new Date().toISOString());

      const url = new URL(spec.authorizeUrl);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', creds.clientId);
      url.searchParams.set('redirect_uri', redirectUri(origin, p));
      url.searchParams.set('state', state);
      if (spec.scope) url.searchParams.set('scope', spec.scope);
      if (verifier) {
        url.searchParams.set(
          'code_challenge',
          createHash('sha256').update(verifier).digest('base64url'),
        );
        url.searchParams.set('code_challenge_method', 'S256');
      }
      // 이 브라우저에서 시작한 로그인인지 콜백에서 대조 (로그인 CSRF 방지)
      reply.setCookie(STATE_COOKIE, state, cookieOptions(STATE_TTL));
      return reply.redirect(url.toString());
    },
  );

  // 2) 콜백: state 확인(한 번만) → 코드 교환 → 프로필 → 계정 연결/가입 → 세션
  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>(
    '/auth/:provider/callback',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const p = req.params.provider;
      const { code, state, error } = req.query;
      const origin = requestOrigin(config, req.headers);
      reply.clearCookie(STATE_COOKIE, { path: '/' });
      if (error) return reply.redirect(fail(origin, 'cancelled'));
      const creds = isProvider(p) ? credentialsFor(config, p) : null;
      if (!isProvider(p) || !creds || !code || !state) return reply.redirect(fail(origin, 'state'));

      // state는 어떤 결과든 한 번 쓰면 끝 (실패한 시도로 다시 쓸 수 없게)
      const row = db
        .prepare(
          'SELECT provider, code_verifier, return_to, created_at FROM oauth_states WHERE state_hash = ?',
        )
        .get(sha256(state)) as
        | { provider: string; code_verifier: string | null; return_to: string; created_at: string }
        | undefined;
      db.prepare('DELETE FROM oauth_states WHERE state_hash = ?').run(sha256(state));
      if (
        !row ||
        row.provider !== p ||
        Date.now() - Date.parse(row.created_at) > STATE_TTL ||
        req.cookies[STATE_COOKIE] !== state
      )
        return reply.redirect(fail(origin, 'state'));

      let profile: Profile;
      try {
        // 토큰 교환 + 프로필 = 외부 호출 2번 (API 사용량에 기록만, 멈출 수 없음)
        trackApi(`oauth_${p}`, 2);
        const token = await exchangeCode(SPECS[p], creds, {
          code,
          state,
          redirectUri: redirectUri(origin, p),
          codeVerifier: row.code_verifier,
        });
        profile = await SPECS[p].profile(token);
        if (!profile.providerUserId) throw new Error('no id');
      } catch (e) {
        req.log.warn({ provider: p, err: String(e) }, 'oauth failed');
        return reply.redirect(fail(origin, 'provider'));
      }

      const linked = db
        .prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?')
        .get(p, profile.providerUserId) as { user_id: string } | undefined;
      let userId = linked?.user_id;
      if (userId) {
        const status = db.prepare('SELECT status FROM users WHERE id = ?').get(userId) as {
          status: string;
        };
        // 관리자가 사용을 중지한 계정
        if (status.status !== 'active') return reply.redirect(fail(origin, 'disabled'));
      } else {
        const nickname = (profile.nickname || '여행자').slice(0, 40);
        if (!mayJoin(db, config, p, profile)) {
          audit(db, null, 'signup_denied', `${p}:${profile.providerUserId}`);
          return reply.redirect(fail(origin, requestJoin(db, p, profile.providerUserId, nickname)));
        }
        // 첫 계정 = 관리자 (관리자 고정 목록이 있으면 그 목록만 — 아래 syncAdmins)
        const first =
          fixedAdmins(config).length === 0 &&
          (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n === 0;
        userId = uuidv7();
        const now = new Date().toISOString();
        db.prepare(
          'INSERT INTO users (id, nickname, created_at, is_admin) VALUES (?, ?, ?, ?)',
        ).run(userId, nickname, now, first ? 1 : 0);
        db.prepare(
          'INSERT INTO oauth_accounts (provider, provider_user_id, user_id) VALUES (?, ?, ?)',
        ).run(p, profile.providerUserId, userId);
        audit(db, userId, 'signup', p);
      }
      syncAdmins(db, config);
      // 로그인할 때마다 새 세션 ID (세션 고정 방지)
      const old = req.cookies[SESSION_COOKIE];
      if (old) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(old));
      const token = createSession(db, userId, req.headers['user-agent']);
      audit(db, userId, 'login', p);
      reply.setCookie(SESSION_COOKIE, token, cookieOptions(SESSION_MAX));
      return reply.redirect(`${origin}${row.return_to}`);
    },
  );

  app.post('/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    const user = readSession(db, token);
    if (token) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(token));
    if (user) audit(db, user.userId, 'logout');
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  /** 켜진 로그인 방법 (로그인 화면이 버튼을 고를 때) */
  app.get('/auth/providers', async () => ({
    providers: PROVIDERS.filter((p) => credentialsFor(config, p)),
  }));
}
