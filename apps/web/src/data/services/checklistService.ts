import { db } from '../db';
import { checklistRepo, type DraftEntry } from '../repositories/checklistRepo';
import { settingsRepo } from '../repositories/settingsRepo';

/** 여행별 준비물 카테고리 순서 (사용자가 추가·삭제) */
export const categoriesKey = (tripId: string) => `checklistCategories:${tripId}`;

/** 준비 탭 [저장]: 준비물·할 일·카테고리를 한 번에 (전부 저장되거나 전부 취소) */
export function saveChecklistDraft(
  tripId: string,
  draft: {
    packing: readonly DraftEntry[];
    todo: readonly DraftEntry[];
    categories: readonly string[];
  },
) {
  return db.transaction('rw', db.checklistItems, db.settings, async () => {
    await checklistRepo.applyDraft(tripId, 'packing', draft.packing);
    await checklistRepo.applyDraft(tripId, 'todo', draft.todo);
    await settingsRepo.set(categoriesKey(tripId), [...draft.categories]);
  });
}
