import { ItemMarkSchema, uuidv7, type ItemMark, type ItineraryItem } from '@trippocket/shared';
import { nowIso } from '../clock';
import { db, toDomain } from '../db';

/**
 * 내 일정 표시 (2026-11-25 사용자 요청): 방문·미방문·다녀옴은 계정마다 따로 — 공유 여행이어도 나만 보고 나만 동기화.
 * 서버는 내 것만 내려주므로 이 기기의 itemMarks = 전부 내 것. 일정 저장소(itemRepo)가 읽을 때 일정에 덮어 쓴다
 */
type Fields = Pick<ItineraryItem, 'visit' | 'done'>;

/** 일정 id → 내 표시 (한 일정에 줄이 둘 이상이면 가장 최근 것) */
export async function marksOf(tripIds: readonly string[]): Promise<Map<string, ItemMark>> {
  const rows = tripIds.length
    ? await db.itemMarks
        .where('tripId')
        .anyOf([...new Set(tripIds)])
        .filter((r) => !r.deletedAt)
        .toArray()
    : [];
  const out = new Map<string, ItemMark>();
  for (const r of rows) {
    const cur = out.get(r.itemId);
    if (!cur || cur.updatedAt < r.updatedAt) out.set(r.itemId, toDomain(r));
  }
  return out;
}

/** 일정에 내 표시를 덮어 쓴다 — 일정 자체의 visit·done(예전·일행 표시)은 쓰지 않는다 */
export function withMark<T extends ItineraryItem>(
  item: T,
  mark: Pick<ItemMark, 'visit' | 'done'> | undefined,
): T {
  const { visit: _v, done: _d, ...rest } = item;
  return {
    ...rest,
    ...(mark?.visit ? { visit: mark.visit } : {}),
    ...(mark?.done ? { done: true } : {}),
  } as T;
}

export const markRepo = {
  /** 내 표시 바꾸기 — 없으면 만든다. 값이 undefined면 그 칸을 지운다 */
  async set(item: Pick<ItineraryItem, 'id' | 'tripId'>, fields: Fields): Promise<void> {
    await db.transaction('rw', db.itemMarks, async () => {
      const existing = (await db.itemMarks.where('itemId').equals(item.id).toArray())
        .filter((r) => !r.deletedAt)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
      const now = nowIso();
      const merged: Record<string, unknown> = {
        ...(existing ? toDomain(existing) : { id: uuidv7(), createdAt: now }),
        tripId: item.tripId,
        itemId: item.id,
        visit: fields.visit,
        done: fields.done || undefined,
        updatedAt: now,
      };
      for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
      await db.itemMarks.put({ ...ItemMarkSchema.parse(merged), dirty: 1 });
    });
  },

  /** 방문 기록을 남긴 내 표시 전부 (기록 탭) */
  async listWithVisit(): Promise<ItemMark[]> {
    return (await db.itemMarks.filter((r) => !r.deletedAt && r.visit !== undefined).toArray()).map(
      toDomain,
    );
  },
};
