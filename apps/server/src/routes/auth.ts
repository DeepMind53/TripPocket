import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from '@trippocket/shared';
import type { Config } from '../config';
import type { Db } from '../db/database';
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

/** 가입 정책 (docs/08 G1, 기본 초대제): 첫 계정은 허용, 그다음은 허용 목록(ALLOWED_ACCOUNTS)에 있어야 */
function mayJoin(db: Db, config: Config, provider: ProviderId, profile: Profile): boolean {
  if (config.SIGNUP === 'open') return true;
  const users = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (users === 0) return true;
  const allowed = (config.ALLOWED_ACCOUNTS ?? '').split(',').map((s) => s.trim());
  return allowed.includes(`${provider}:${profile.providerUserId}`);
}

function audit(db: Db, userId: string | null, action: string, target?: string) {
  db.prepare('INSERT INTO audit_log (user_id, action, target, created_at) VALUES (?, ?, ?, ?)').run(
    userId,
    action,
    target ?? null,
    new Date().toISOString(),
  );
}

export function authRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const fail = (code: string, extra = '') => `${config.WEB_ORIGIN}/login?error=${code}${extra}`;

  // 1) 시작: state(+구글은 PKCE) 만들고 제공자 로그인 화면으로
  app.get<{ Params: { provider: string }; Querystring: { returnTo?: string } }>(
    '/auth/:provider/start',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const p = req.params.provider;
      const creds = isProvider(p) ? credentialsFor(config, p) : null;
      if (!isProvider(p) || !creds) return reply.redirect(fail('provider'));
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
      url.searchParams.set('redirect_uri', redirectUri(config, p));
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
      reply.clearCookie(STATE_COOKIE, { path: '/' });
      if (error) return reply.redirect(fail('cancelled'));
      const creds = isProvider(p) ? credentialsFor(config, p) : null;
      if (!isProvider(p) || !creds || !code || !state) return reply.redirect(fail('state'));

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
        return reply.redirect(fail('state'));

      let profile: Profile;
      try {
        const token = await exchangeCode(SPECS[p], creds, {
          code,
          state,
          redirectUri: redirectUri(config, p),
          codeVerifier: row.code_verifier,
        });
        profile = await SPECS[p].profile(token);
        if (!profile.providerUserId) throw new Error('no id');
      } catch (e) {
        req.log.warn({ provider: p, err: String(e) }, 'oauth failed');
        return reply.redirect(fail('provider'));
      }

      const linked = db
        .prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?')
        .get(p, profile.providerUserId) as { user_id: string } | undefined;
      let userId = linked?.user_id;
      if (!userId) {
        if (!mayJoin(db, config, p, profile)) {
          audit(db, null, 'signup_denied', `${p}:${profile.providerUserId}`);
          // 관리자에게 알려 줄 계정 표시 (허용 목록에 넣을 값)
          return reply.redirect(
            fail('invite', `&account=${encodeURIComponent(`${p}:${profile.providerUserId}`)}`),
          );
        }
        userId = uuidv7();
        const now = new Date().toISOString();
        db.prepare('INSERT INTO users (id, nickname, created_at) VALUES (?, ?, ?)').run(
          userId,
          (profile.nickname || '여행자').slice(0, 40),
          now,
        );
        db.prepare(
          'INSERT INTO oauth_accounts (provider, provider_user_id, user_id) VALUES (?, ?, ?)',
        ).run(p, profile.providerUserId, userId);
        audit(db, userId, 'signup', p);
      }
      // 로그인할 때마다 새 세션 ID (세션 고정 방지)
      const old = req.cookies[SESSION_COOKIE];
      if (old) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(old));
      const token = createSession(db, userId, req.headers['user-agent']);
      audit(db, userId, 'login', p);
      reply.setCookie(SESSION_COOKIE, token, cookieOptions(SESSION_MAX));
      return reply.redirect(`${config.WEB_ORIGIN}${row.return_to}`);
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
