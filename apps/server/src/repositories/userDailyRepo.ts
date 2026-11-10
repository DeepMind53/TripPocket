import type { Db } from '../db/database';

/** 하루 = 한국 날짜 (사람마다 같은 기준으로 0시에 다시 채운다) */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

/**
 * 한 사람 하루 사용 횟수 (길 조회·영수증 분석): places_usage 표에서 그 kind 줄만 읽고 쓴다.
 * 사람 id·날짜·횟수만 — 좌표·사진은 받지 않는다
 */
export function userDailyRepo(db: Db, kind: string) {
  return {
    used(userId: string): number {
      return (
        (
          db
            .prepare('SELECT count FROM places_usage WHERE user_id = ? AND date = ? AND kind = ?')
            .get(userId, today(), kind) as { count: number } | undefined
        )?.count ?? 0
      );
    },
    bump(userId: string): void {
      db.prepare(
        `INSERT INTO places_usage (user_id, date, kind, count) VALUES (?, ?, ?, 1)
         ON CONFLICT (user_id, date, kind) DO UPDATE SET count = count + 1`,
      ).run(userId, today(), kind);
    },
  };
}
