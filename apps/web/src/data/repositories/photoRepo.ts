import { uuidv7 } from '@trippocket/shared';
import { nowIso } from '../clock';
import { db, type PhotoRow } from '../db';

/**
 * 일정 사진·영수증 저장소 (ADR-0012): 이 기기에만. 동기화(dirty)·서버 업로드·백업이 없다 — 일부러 그렇게 둔다.
 * 아예 지운 일정의 사진은 휴지통 정리(trashRepo.purge) 때 함께 지운다
 */
export const photoRepo = {
  async add(input: Pick<PhotoRow, 'tripId' | 'itemId' | 'kind' | 'blob'>): Promise<PhotoRow> {
    const row: PhotoRow = { ...input, id: uuidv7(), createdAt: nowIso() };
    await db.photos.add(row);
    return row;
  },

  listByItem(itemId: string): Promise<PhotoRow[]> {
    return db.photos.where('itemId').equals(itemId).sortBy('createdAt');
  },

  /** 다른 일정으로 옮기기 (편집에서 날짜·일정 고르기) */
  async moveTo(id: string, itemId: string): Promise<void> {
    await db.photos.update(id, { itemId });
  },

  /** 영수증에서 읽은 글 (분석 결과 또는 사용자가 고친 글) */
  async setText(id: string, text: string, source: PhotoRow['textSource']): Promise<void> {
    await db.photos.update(id, { text, textSource: source });
  },

  /** 사진 분류 묶음 */
  async setTag(id: string, tag: NonNullable<PhotoRow['tag']>): Promise<void> {
    await db.photos.update(id, { tag });
  },

  /** 기록 탭 사진 모아보기 — 찍은 순 */
  listAll(): Promise<PhotoRow[]> {
    return db.photos.orderBy('id').toArray();
  },

  async remove(id: string): Promise<void> {
    await db.photos.delete(id);
  },
};
