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
import { visitPatch, type Visit } from '../../domain/visit';

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
  /** 해당 날짜 맨 뒤에 추가 (index를 주면 그 자리에) */
  async create(input: NewItem, index?: number): Promise<ItineraryItem> {
    return db.transaction('rw', db.items, async () => {
      const siblings = await dayRows(input.tripId, input.date);
      const at = Math.max(0, Math.min(index ?? siblings.length, siblings.length));
      const prev = siblings[at - 1]?.order ?? null;
      const next = siblings[at]?.order ?? null;
      // 키가 겹친 드문 경우(다른 기기 동시 수정)는 맨 뒤로
      const order =
        prev !== null && next !== null && compareKeys(prev, next) >= 0
          ? keyBetween(siblings.at(-1)?.order ?? null, null)
          : keyBetween(prev, next);
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

  /** 방문 기록을 남긴 일정 전부 (기록 탭) — 날짜 최근 순 */
  async listVisited(): Promise<ItineraryItem[]> {
    const rows = await db.items.filter((r) => !r.deletedAt && r.visit !== undefined).toArray();
    rows.sort((a, b) => compareKeys(b.date ?? '', a.date ?? '') || compareKeys(a.order, b.order));
    return rows.map(toDomain);
  },

  async listByDay(tripId: string, date: LocalDate | null): Promise<ItineraryItem[]> {
    return (await dayRows(tripId, date)).map(toDomain);
  },

  async update(id: string, patch: ItemPatch): Promise<ItineraryItem> {
    return db.transaction('rw', db.items, async () => {
      const row = await db.items.get(id);
      if (!row || row.deletedAt) throw new Error(`일정을 찾을 수 없어요: ${id}`);
      // 다녀옴(done)과 방문 기록(visit)은 함께 바뀐다 (domain/visit.ts)
      const linked =
        'done' in patch || 'visit' in patch
          ? visitPatch(row, { done: patch.done, visit: patch.visit })
          : {};
      const merged: Record<string, unknown> = {
        ...toDomain(row),
        ...patch,
        ...linked,
        updatedAt: nowIso(),
      };
      for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
      const item = ItineraryItemSchema.parse(merged);
      await db.items.put({ ...item, dirty: 1 });
      return item;
    });
  },

  /** 지난 일정의 방문 기록: 방문·미방문, null이면 기록 지우기 (다녀옴도 함께) */
  async setVisit(id: string, visit: Visit | null): Promise<ItineraryItem> {
    const row = await db.items.get(id);
    if (!row) throw new Error(`일정을 찾을 수 없어요: ${id}`);
    return this.update(id, visitPatch(row, { visit }));
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

  /** 하루의 순서를 통째로 다시 매긴다 (시간순 정렬 등). ids는 그날 일정 전체여야 한다 */
  async reorderDay(tripId: string, date: LocalDate | null, ids: readonly string[]): Promise<void> {
    await db.transaction('rw', db.items, async () => {
      const rows = await dayRows(tripId, date);
      const byId = new Map(rows.map((r) => [r.id, r]));
      if (ids.length !== rows.length || ids.some((id) => !byId.has(id))) {
        throw new Error('그날 일정 목록이 바뀌었어요. 다시 시도해 주세요');
      }
      const keys = keysBetween(null, null, ids.length);
      const now = nowIso();
      await db.items.bulkPut(
        ids.map((id, i) => ({
          ...(byId.get(id) as Row),
          order: keys[i] as string,
          updatedAt: now,
          dirty: 1 as const,
        })),
      );
    });
  },

  /**
   * 여러 일정의 날짜를 한 번에 바꾼다 (기간 변경). 같은 날 안의 순서는 유지하고,
   * '가고 싶은 곳'으로 가는 일정은 기존 목록 뒤에 붙인다.
   */
  async setDates(
    tripId: string,
    moves: ReadonlyArray<{ id: string; to: LocalDate | null }>,
  ): Promise<void> {
    if (moves.length === 0) return;
    await db.transaction('rw', db.items, async () => {
      const now = nowIso();
      const toWish = moves.filter((m) => m.to === null);
      const wishTail = (await dayRows(tripId, null)).at(-1)?.order ?? null;
      const wishKeys = keysBetween(wishTail, null, toWish.length);
      for (const m of moves) {
        const wishIndex = toWish.indexOf(m);
        await db.items.update(m.id, {
          date: m.to,
          ...(m.to === null ? { order: wishKeys[wishIndex] as string } : {}),
          updatedAt: now,
          dirty: 1,
        });
      }
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
