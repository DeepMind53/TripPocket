import type { Db } from '../db/database';

/** 한 사람 하루 길 조회 한도 (자동 + [현재 위치] 합계, 사용자 결정 2026-11-10) */
export const ROUTE_DAILY_LIMIT = 50;

const KIND = 'route_eta';
/** 하루 = 한국 날짜 (사람마다 같은 기준으로 0시에 다시 채운다) */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

/**
 * 길 조회 사용량 (POST /api/routes/eta): places_usage 표의 kind = route_eta 줄만 읽고 쓴다.
 * 좌표는 받지 않는다 — 사람 id·날짜·횟수만
 */
export function routeUsageRepo(db: Db) {
  return {
    used(userId: string): number {
      return (
        (
          db
            .prepare('SELECT count FROM places_usage WHERE user_id = ? AND date = ? AND kind = ?')
            .get(userId, today(), KIND) as { count: number } | undefined
        )?.count ?? 0
      );
    },
    bump(userId: string): void {
      db.prepare(
        `INSERT INTO places_usage (user_id, date, kind, count) VALUES (?, ?, ?, 1)
         ON CONFLICT (user_id, date, kind) DO UPDATE SET count = count + 1`,
      ).run(userId, today(), KIND);
    },
  };
}
