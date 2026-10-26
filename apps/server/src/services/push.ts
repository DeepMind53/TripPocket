import { DEFAULT_PUSH_PREFS, PUSH_KINDS, type PushKind, type PushPrefs } from '@trippocket/shared';
import webpush from 'web-push';
import type { Config } from '../config';
import type { Db } from '../db/database';
import { apiAllowed, trackApi } from './apiUsage';

export { PUSH_KINDS, type PushKind, type PushPrefs };
export const DEFAULT_PREFS: PushPrefs = DEFAULT_PUSH_PREFS;

export interface PushMessage {
  title: string;
  body: string;
  /** 누르면 열 앱 안 주소 (예: /trips/<id>/essentials) */
  url: string;
}

let ready = false;
/** VAPID 키가 있을 때만 알림을 보낸다 (.env) */
export function initPush(config: Config): boolean {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    config.VAPID_SUBJECT ?? 'https://trippocket.day',
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY,
  );
  ready = true;
  return true;
}

interface SubRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  prefs_json: string;
}

/**
 * 한 사람의 기기들로 알림 (그 종류를 켠 기기만).
 * dedupeKey가 있으면 같은 알림은 한 번만 (push_sent). 사라진 구독(404·410)은 지운다.
 * 내용은 웹 푸시 표준 암호화로 브라우저 회사(구글·애플 등) 서버를 거쳐 기기로 간다 — 그 서버는 내용을 못 읽음
 */
export async function sendPush(
  db: Db,
  userId: string,
  kind: PushKind,
  msg: PushMessage,
  dedupeKey?: string,
): Promise<number> {
  if (!ready || !apiAllowed('web_push')) return 0;
  if (dedupeKey) {
    const fresh = db
      .prepare('INSERT OR IGNORE INTO push_sent (user_id, key, sent_at) VALUES (?, ?, ?)')
      .run(userId, dedupeKey, new Date().toISOString());
    if (fresh.changes === 0) return 0;
  }
  const subs = db
    .prepare(
      'SELECT id, endpoint, p256dh, auth, prefs_json FROM push_subscriptions WHERE user_id = ?',
    )
    .all(userId) as unknown as SubRow[];
  let sent = 0;
  for (const s of subs) {
    const prefs = { ...DEFAULT_PREFS, ...(JSON.parse(s.prefs_json) as Partial<PushPrefs>) };
    if (!prefs[kind]) continue;
    try {
      trackApi('web_push');
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(msg),
        { TTL: 3600 * 6 },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410)
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
    }
  }
  return sent;
}
