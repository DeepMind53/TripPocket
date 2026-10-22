import {
  compareKeys,
  ItineraryItemSchema,
  keyBetween,
  keysBetween,
  uuidv7,
  type ItineraryItem,
  type LocalDate,
} from '@trippocket/shared';
import { nowIso } from '../clock';
import { db, toDomain, type Stored } from '../db';

export type NewItem = Omit<
  ItineraryItem,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'rev' | 'order'
>;
type Editable = Omit<NewItem, 'tripId' | 'date'>;
/** 날짜·순서는 move()로만 바꾼다. 값을 undefined로 주면 그 항목을 지운다 */
export type ItemPatch = { [K in keyof Editable]?: Editable[K] | undefined };

type Row = Stored<ItineraryItem>;

/** 같은 날짜(null = 가고 싶은 곳)의 일정, 정렬 키 순 */
async function dayRows(tripId: string, date: LocalDate | null): Promise<Row[]> {
  const rows = await db.items
    .where('tripId')
    .equals(tripId)
    .filter((r) => !r.deletedAt && r.date === date)
    .toArray();
  return rows.sort((a, b) => compareKeys(a.order, b.order) || compareKeys(a.id, b.id));
}

export const itemRepo = {
  /** 해당 날짜 맨 뒤에 추가 */
  async create(input: NewItem): Promise<ItineraryItem> {
    return db.transaction('rw', db.items, async () => {
      const siblings = await dayRows(input.tripId, input.date);
      const order = keyBetween(siblings.at(-1)?.order ?? null, null);
      const now = nowIso();
      const item = ItineraryItemSchema.parse({
        ...input,
        id: uuidv7(),
        order,
        createdAt: now,
        updatedAt: now,
      });
      await db.items.add({ ...item, dirty: 1 });
      return item;
    });
  },

  async get(id: string): Promise<ItineraryItem | undefined> {
    const row = await db.items.get(id);
    return row && !row.deletedAt ? toDomain(row) : undefined;
  },

  /** 여행의 모든 일정: 날짜 순(가고 싶은 곳은 맨 뒤) → 정렬 키 순 */
  async listByTrip(tripId: string): Promise<ItineraryItem[]> {
    const rows = await db.items
      .where('tripId')
      .equals(tripId)
      .filter((r) => !r.deletedAt)
      .toArray();
    rows.sort((a, b) => {
      if (a.date !== b.date) {
        if (a.date === null) return 1;
        if (b.date === null) return -1;
        return compareKeys(a.date, b.date);
      }
      return compareKeys(a.order, b.order) || compareKeys(a.id, b.id);
    });
    return rows.map(toDomain);
  },

  async listByDay(tripId: string, date: LocalDate | null): Promise<ItineraryItem[]> {
    return (await dayRows(tripId, date)).map(toDomain);
  },

  async update(id: string, patch: ItemPatch): Promise<ItineraryItem> {
    return db.transaction('rw', db.items, async () => {
      const row = await db.items.get(id);
      if (!row || row.deletedAt) throw new Error(`일정을 찾을 수 없어요: ${id}`);
      const merged: Record<string, unknown> = { ...toDomain(row), ...patch, updatedAt: nowIso() };
      for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
      const item = ItineraryItemSchema.parse(merged);
      await db.items.put({ ...item, dirty: 1 });
      return item;
    });
  },

  /**
   * 일정을 toDate의 index 위치로 옮긴다 (다른 날로 이동 포함).
   * 옮긴 일정 하나만 저장한다. 키가 겹친 드문 경우(다른 기기 동시 수정)에만 그날 전체 키를 다시 매긴다.
   */
  async move(id: string, toDate: LocalDate | null, index: number): Promise<void> {
    await db.transaction('rw', db.items, async () => {
      const row = await db.items.get(id);
      if (!row || row.deletedAt) throw new Error(`일정을 찾을 수 없어요: ${id}`);
      const siblings = (await dayRows(row.tripId, toDate)).filter((r) => r.id !== id);
      const at = Math.max(0, Math.min(index, siblings.length));
      const prev = siblings[at - 1]?.order ?? null;
      const next = siblings[at]?.order ?? null;
      const now = nowIso();

      if (prev !== null && next !== null && compareKeys(prev, next) >= 0) {
        const ordered = [...siblings.slice(0, at), row, ...siblings.slice(at)];
        const keys = keysBetween(null, null, ordered.length);
        await db.items.bulkPut(
          ordered.map((r, i) => ({
            ...r,
            date: toDate,
            order: keys[i] as string,
            updatedAt: now,
            dirty: 1 as const,
          })),
        );
        return;
      }

      await db.items.update(id, {
        date: toDate,
        order: keyBetween(prev, next),
        updatedAt: now,
        dirty: 1,
      });
    });
  },

  async softDelete(id: string): Promise<void> {
    const now = nowIso();
    await db.items.update(id, { deletedAt: now, updatedAt: now, dirty: 1 });
  },

  async restore(id: string): Promise<void> {
    await db.items.update(id, { deletedAt: undefined, updatedAt: nowIso(), dirty: 1 });
  },
};
