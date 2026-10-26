import { SAVED_PLACES_MAX, SavedPlaceSchema, uuidv7, type SavedPlace } from '@trippocket/shared';
import { nowIso } from '../clock';
import { db, toDomain } from '../db';

export type NewSavedPlace = Omit<
  SavedPlace,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'rev'
>;

/** 저장한 장소가 이미 200곳 (SAVED_PLACES_MAX) — 화면은 안내만 */
export class SavedLimitError extends Error {
  constructor() {
    super('saved places limit');
  }
}

/** 저장한 장소 (S-04) — 여행과 상관없는 개인 목록, 동기화 대상. 한 사람 200곳까지 */
export const savedPlaceRepo = {
  async create(input: NewSavedPlace): Promise<SavedPlace> {
    const count = await db.savedPlaces.filter((r) => !r.deletedAt).count();
    if (count >= SAVED_PLACES_MAX) throw new SavedLimitError();
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

  /**
   * 나라 코드가 없는 예전 저장(2026-10-26 전)을 도시 이름으로 채운다. countryOf는 도시 데이터를 쓰는
   * 화면(저장 탭)이 넘긴다 — 도시 데이터를 첫 화면에 넣지 않으려고. 바꾼 수를 돌려준다
   */
  async fillCountries(countryOf: (cityTag: string) => string | undefined): Promise<number> {
    const rows = await db.savedPlaces
      .filter((r) => !r.deletedAt && !r.countryCode && !!r.cityTag)
      .toArray();
    let n = 0;
    for (const r of rows) {
      const code = countryOf(r.cityTag!);
      if (!code) continue;
      await db.savedPlaces.update(r.id, { countryCode: code, updatedAt: nowIso(), dirty: 1 });
      n++;
    }
    return n;
  },

  async softDelete(id: string): Promise<void> {
    const now = nowIso();
    await db.savedPlaces.update(id, { deletedAt: now, updatedAt: now, dirty: 1 });
  },

  async restore(id: string): Promise<void> {
    await db.savedPlaces.update(id, { deletedAt: undefined, updatedAt: nowIso(), dirty: 1 });
  },
};
