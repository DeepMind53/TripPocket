import { uuidv7 } from '@trippocket/shared';
import type { Transaction } from 'dexie';

/**
 * v17 (2026-11-25 사용자 요청 "개인별로 달라야 하는 것은 계정별로"): 일정의 방문·다녀옴과 여행의 하루 한 줄을
 * 내 기록 표(itemMarks·dayNotes)로 옮긴다.
 * - 서버(마이그레이션 25)가 예전 표시를 여행 주인 것으로 옮겨 내려주므로, 기기에서는 **아직 올리지 않은 내 변경(dirty)만**
 *   내 기록으로 옮기고(dirty로 — 다음 동기화 때 올라감) 나머지는 지운다. 일행이 남긴 표시가 내 것이 되지 않게
 * - 일정·여행 행 자체는 dirty로 바꾸지 않는다 (서버도 같은 칸을 지워 내려준다)
 */
export async function upgradeToV17(tx: Transaction): Promise<void> {
  const now = new Date().toISOString();
  const marks: Record<string, unknown>[] = [];
  await tx
    .table('items')
    .toCollection()
    .modify((row: Record<string, unknown>) => {
      if (row.visit === undefined && row.done === undefined) return;
      if (row.dirty === 1 && !row.deletedAt && typeof row.tripId === 'string')
        marks.push({
          id: uuidv7(),
          tripId: row.tripId,
          itemId: row.id,
          ...(row.visit ? { visit: row.visit } : {}),
          ...(row.done === true ? { done: true } : {}),
          createdAt: now,
          updatedAt: now,
          dirty: 1,
        });
      delete row.visit;
      delete row.done;
    });
  if (marks.length) await tx.table('itemMarks').bulkAdd(marks);
  const notes: Record<string, unknown>[] = [];
  await tx
    .table('trips')
    .toCollection()
    .modify((row: Record<string, unknown>) => {
      const list = row.dayNotes as { date: string; text: string }[] | undefined;
      if (!list) return;
      if (row.dirty === 1 && !row.deletedAt)
        for (const n of list)
          notes.push({
            id: uuidv7(),
            tripId: row.id,
            date: n.date,
            text: n.text,
            createdAt: now,
            updatedAt: now,
            dirty: 1,
          });
      delete row.dayNotes;
    });
  if (notes.length) await tx.table('dayNotes').bulkAdd(notes);
}
