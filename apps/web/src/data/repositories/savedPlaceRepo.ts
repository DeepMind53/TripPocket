import { SavedPlaceSchema, uuidv7, type SavedPlace } from '@trippocket/shared';
import { nowIso } from '../clock';
import { db, toDomain } from '../db';

export type NewSavedPlace = Omit<
  SavedPlace,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'rev'
>;

/** 저장한 장소 (S-04) — 여행과 상관없는 개인 목록, 동기화 대상 */
export const savedPlaceRepo = {
  async create(input: NewSavedPlace): Promise<SavedPlace> {
    const now = nowIso();
    const place = SavedPlaceSchema.parse({
      ...input,
      id: uuidv7(),
      createdAt: now,
      updatedAt: now,
    });
    await db.savedPlaces.add({ ...place, dirty: 1 });
    return place;
  },

  async listActive(): Promise<SavedPlace[]> {
    const rows = await db.savedPlaces.filter((r) => !r.deletedAt).toArray();
    return rows.map(toDomain).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async softDelete(id: string): Promise<void> {
    const now = nowIso();
    await db.savedPlaces.update(id, { deletedAt: now, updatedAt: now, dirty: 1 });
  },

  async restore(id: string): Promise<void> {
    await db.savedPlaces.update(id, { deletedAt: undefined, updatedAt: nowIso(), dirty: 1 });
  },
};
