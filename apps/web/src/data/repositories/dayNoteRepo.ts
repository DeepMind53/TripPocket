import { DayNoteSchema, uuidv7, type DayNote } from '@trippocket/shared';
import { nowIso } from '../clock';
import { db, toDomain } from '../db';
import { DAY_NOTE_MAX } from '../../domain/dayNotes';

/**
 * 내 하루 한 줄 기록 (2026-11-25 사용자 요청 — 계정마다 따로): 여행·날짜마다 한 줄.
 * 공유 여행이어도 나만 보고 나만 동기화한다 (서버가 내 것만 내려줌). 보기 전용 여행에서도 쓸 수 있다
 */
export const dayNoteRepo = {
  /** 여행의 내 기록, 날짜 순 */
  async listByTrip(tripId: string): Promise<DayNote[]> {
    const rows = await db.dayNotes
      .where('tripId')
      .equals(tripId)
      .filter((r) => !r.deletedAt)
      .toArray();
    return rows.map(toDomain).sort((a, b) => a.date.localeCompare(b.date));
  },

  /** 모든 여행의 내 기록 (기록 탭), 날짜 순 */
  async listAll(): Promise<DayNote[]> {
    const rows = await db.dayNotes.filter((r) => !r.deletedAt).toArray();
    return rows.map(toDomain).sort((a, b) => a.date.localeCompare(b.date));
  },

  /** 그 날짜의 한 줄 바꾸기. 앞뒤 공백·줄바꿈은 한 칸으로, 빈 글이면 지운다 */
  async set(tripId: string, date: string, text: string): Promise<void> {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, DAY_NOTE_MAX);
    await db.transaction('rw', db.dayNotes, async () => {
      const rows = await db.dayNotes
        .where('[tripId+date]')
        .equals([tripId, date])
        .filter((r) => !r.deletedAt)
        .toArray();
      const now = nowIso();
      const [keep, ...extra] = rows;
      // 같은 날짜 줄이 둘 이상(다른 기기에서 따로 만든 경우)이면 하나만 남긴다
      for (const r of extra)
        await db.dayNotes.put({ ...r, deletedAt: now, updatedAt: now, dirty: 1 });
      if (!clean) {
        if (keep) await db.dayNotes.put({ ...keep, deletedAt: now, updatedAt: now, dirty: 1 });
        return;
      }
      const note = DayNoteSchema.parse({
        ...(keep ? toDomain(keep) : { id: uuidv7(), createdAt: now }),
        tripId,
        date,
        text: clean,
        updatedAt: now,
      });
      await db.dayNotes.put({ ...note, dirty: 1 });
    });
  },
};
