import { TripSchema, uuidv7, type Trip } from '@trippocket/shared';
import { nowIso } from '../clock';
import { db, toDomain } from '../db';

export type NewTrip = Omit<
  Trip,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'rev' | 'archivedAt'
>;
export type TripPatch = Partial<NewTrip>;

/** 여행 저장소. 모든 쓰기는 검증 → updatedAt 갱신 → dirty 표시 (docs/conventions/coding-rules.md §4) */
export const tripRepo = {
  async create(input: NewTrip): Promise<Trip> {
    const now = nowIso();
    const trip = TripSchema.parse({ ...input, id: uuidv7(), createdAt: now, updatedAt: now });
    await db.trips.add({ ...trip, dirty: 1 });
    return trip;
  },

  /** 삭제되지 않은 여행 하나 */
  async get(id: string): Promise<Trip | undefined> {
    const row = await db.trips.get(id);
    return row && !row.deletedAt ? toDomain(row) : undefined;
  },

  /** 삭제되지 않은 여행 전체, 시작일 순 */
  async listActive(): Promise<Trip[]> {
    const rows = await db.trips
      .orderBy('startDate')
      .filter((t) => !t.deletedAt)
      .toArray();
    return rows.map(toDomain);
  },

  async update(id: string, patch: TripPatch): Promise<Trip> {
    return db.transaction('rw', db.trips, async () => {
      const row = await db.trips.get(id);
      if (!row || row.deletedAt) throw new Error(`여행을 찾을 수 없어요: ${id}`);
      const trip = TripSchema.parse({ ...toDomain(row), ...patch, updatedAt: nowIso() });
      await db.trips.put({ ...trip, dirty: 1 });
      return trip;
    });
  },

  /** 휴지통으로 (실행 취소·동기화를 위해 바로 지우지 않는다) */
  async softDelete(id: string): Promise<void> {
    const now = nowIso();
    await db.trips.update(id, { deletedAt: now, updatedAt: now, dirty: 1 });
  },

  async restore(id: string): Promise<void> {
    await db.trips.update(id, { deletedAt: undefined, updatedAt: nowIso(), dirty: 1 });
  },
};
