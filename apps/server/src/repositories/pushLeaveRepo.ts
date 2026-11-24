import type { Db } from '../db/database';

/** 나갈 시각 알림 (ADR-0013): 앱이 계산한 "HH:mm"만 — 좌표·이동 시간은 없다 */
export interface LeaveRow {
  userId: string;
  itemId: string;
  tripId: string;
  date: string;
  leaveAt: string;
}

export function pushLeaveRepo(db: Db) {
  return {
    /** 그 여행 멤버이고 그 여행의 (지우지 않은) 일정인지 */
    canSet(userId: string, tripId: string, itemId: string): boolean {
      const member = db
        .prepare('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?')
        .get(tripId, userId);
      if (!member) return false;
      return !!db
        .prepare(
          "SELECT 1 FROM records WHERE table_name = 'items' AND id = ? AND trip_id = ? AND deleted_at IS NULL",
        )
        .get(itemId, tripId);
    },
    set(row: LeaveRow): void {
      db.prepare(
        `INSERT INTO push_leave (user_id, item_id, trip_id, date, leave_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, item_id) DO UPDATE SET trip_id = excluded.trip_id, date = excluded.date,
           leave_at = excluded.leave_at, updated_at = excluded.updated_at`,
      ).run(row.userId, row.itemId, row.tripId, row.date, row.leaveAt, new Date().toISOString());
    },
    remove(userId: string, itemId: string): void {
      db.prepare('DELETE FROM push_leave WHERE user_id = ? AND item_id = ?').run(userId, itemId);
    },
    /** 이 사람·여행의 오늘 나갈 시각들 */
    forTripDay(userId: string, tripId: string, date: string): LeaveRow[] {
      return (
        db
          .prepare(
            'SELECT user_id, item_id, trip_id, date, leave_at FROM push_leave WHERE user_id = ? AND trip_id = ? AND date = ?',
          )
          .all(userId, tripId, date) as {
          user_id: string;
          item_id: string;
          trip_id: string;
          date: string;
          leave_at: string;
        }[]
      ).map((r) => ({
        userId: r.user_id,
        itemId: r.item_id,
        tripId: r.trip_id,
        date: r.date,
        leaveAt: r.leave_at,
      }));
    },
    /** before보다 앞 날짜 줄 지우기 — 부르는 쪽이 시간대 차이만큼 여유를 둔다 */
    prune(before: string): void {
      db.prepare('DELETE FROM push_leave WHERE date < ?').run(before);
    },
  };
}
