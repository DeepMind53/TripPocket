import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { DEFAULT_PREFS, PUSH_KINDS, type PushPrefs } from '../services/push';

const isUrl = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length > 1000) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};
const isKey = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{10,200}$/.test(v);
const prefsOf = (v: unknown): PushPrefs => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return Object.fromEntries(
    PUSH_KINDS.map((k) => [k, typeof o[k] === 'boolean' ? o[k] : DEFAULT_PREFS[k]]),
  ) as PushPrefs;
};

/** 알림 켜기·끄기 (docs/20 G1). 로그인 필요, 자기 기기만 */
export function pushRoutes(app: FastifyInstance, config: Config, db: Db): void {
  const auth = { preHandler: requireUser(db) };

  app.get('/api/push/key', auth, async (_req, reply) => {
    if (!config.VAPID_PUBLIC_KEY) return reply.code(503).send({ error: 'not_configured' });
    return { key: config.VAPID_PUBLIC_KEY };
  });

  // 기기 구독 등록·종류 바꾸기 (같은 endpoint면 덮어씀)
  app.put<{
    Body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; prefs?: unknown };
  }>(
    '/api/push/subscription',
    { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { endpoint, keys, prefs } = req.body ?? {};
      if (!isUrl(endpoint) || !isKey(keys?.p256dh) || !isKey(keys?.auth))
        return reply.code(400).send({ error: 'bad_request' });
      const p = prefsOf(prefs);
      db.prepare(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, prefs_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh,
           auth = excluded.auth, prefs_json = excluded.prefs_json`,
      ).run(
        req.user!.userId,
        endpoint,
        keys.p256dh,
        keys.auth,
        JSON.stringify(p),
        new Date().toISOString(),
      );
      return { prefs: p };
    },
  );

  app.delete<{ Body: { endpoint?: unknown } }>('/api/push/subscription', auth, async (req) => {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint === 'string')
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(
        endpoint,
        req.user!.userId,
      );
    return { ok: true };
  });
}
