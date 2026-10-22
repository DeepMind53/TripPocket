import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/database';

/**
 * 서버 세션 (docs/09 §4.2): 256bit 무작위 ID, DB에는 SHA-256 해시만.
 * 30일 슬라이딩, 절대 만료 90일. 쿠키 __Host-sid (HttpOnly·Secure·SameSite=Lax·Path=/)
 */
export const SESSION_COOKIE = '__Host-sid';
const DAY = 86_400_000;
const SLIDING = 30 * DAY;
const ABSOLUTE = 90 * DAY;

export const sha256 = (s: string) => createHash('sha256').update(s).digest('base64url');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const cookieOptions = (maxAgeMs: number) =>
  ({
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  }) as const;

export function createSession(db: Db, userId: string, userAgent: string | undefined): string {
  const token = randomToken();
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at, absolute_expires_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    sha256(token),
    userId,
    new Date(now).toISOString(),
    new Date(now).toISOString(),
    new Date(now + SLIDING).toISOString(),
    new Date(now + ABSOLUTE).toISOString(),
    (userAgent ?? '').slice(0, 200),
  );
  return token;
}

export interface SessionUser {
  userId: string;
  sessionHash: string;
}

/** 쿠키 → 사용자. 만료됐으면 지우고 null. 사용할 때마다 만료를 늦춘다 (1시간에 한 번만 기록) */
export function readSession(db: Db, token: string | undefined): SessionUser | null {
  if (!token) return null;
  const hash = sha256(token);
  const row = db
    .prepare(
      `SELECT s.user_id, s.expires_at, s.absolute_expires_at, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id_hash = ? AND u.status = 'active'`,
    )
    .get(hash) as
    | { user_id: string; expires_at: string; absolute_expires_at: string; last_seen_at: string }
    | undefined;
  if (!row) return null;
  const now = Date.now();
  if (Date.parse(row.expires_at) < now || Date.parse(row.absolute_expires_at) < now) {
    db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash);
    return null;
  }
  if (now - Date.parse(row.last_seen_at) > 3_600_000) {
    const expires = Math.min(now + SLIDING, Date.parse(row.absolute_expires_at));
    db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id_hash = ?').run(
      new Date(now).toISOString(),
      new Date(expires).toISOString(),
      hash,
    );
  }
  return { userId: row.user_id, sessionHash: hash };
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

/** 모든 /api 데이터 접근은 이걸 거친다 (docs/09 §5) — 로그인 안 했으면 401 */
export function requireUser(db: Db) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = readSession(db, req.cookies[SESSION_COOKIE]);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    req.user = user;
  };
}
