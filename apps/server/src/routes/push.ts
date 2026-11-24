import type { FastifyInstance } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { requireUser } from '../auth/session';
import { DEFAULT_PREFS, PUSH_KINDS, type PushPrefs } from '../services/push';
import { pushLeaveRepo } from '../repositories/pushLeaveRepo';

const isUrl = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length > 1000) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};
const isKey = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{10,200}$/.test(v);
const isId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHm = (v: unknown): v is string =>
  typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
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

  // 나갈 시각 (ADR-0013): 앱이 계산한 "HH:mm"만 받는다 — 좌표·이동 시간은 받지 않는다
  const leave = pushLeaveRepo(db);
  app.put<{ Body: { tripId?: unknown; itemId?: unknown; date?: unknown; leaveAt?: unknown } }>(
    '/api/push/leave',
    { ...auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { tripId, itemId, date, leaveAt } = req.body ?? {};
      if (!isId(tripId) || !isId(itemId) || !isDate(date) || !isHm(leaveAt))
        return reply.code(400).send({ error: 'bad_request' });
      // 남의 여행·없는 일정은 있는지조차 알리지 않는다
      if (!leave.canSet(req.user!.userId, tripId, itemId))
        return reply.code(404).send({ error: 'not_found' });
      leave.set({ userId: req.user!.userId, tripId, itemId, date, leaveAt });
      return { ok: true };
    },
  );
  app.delete<{ Body: { itemId?: unknown } }>('/api/push/leave', auth, async (req, reply) => {
    const itemId = req.body?.itemId;
    if (!isId(itemId)) return reply.code(400).send({ error: 'bad_request' });
    leave.remove(req.user!.userId, itemId);
    return { ok: true };
  });
}
