import { db } from '../db';
import { itemRepo } from '../repositories/itemRepo';
import { tripRepo, type TripPatch } from '../repositories/tripRepo';
import type { DateMove } from '../../domain/schedule';

/**
 * 여행 정보 수정 + 기간 변경에 따른 일정 이동을 한 번에 (전부 저장되거나 전부 취소).
 * 이동 계획은 domain/schedule.planReflow로 미리 계산해 사용자에게 보여준 것을 그대로 쓴다.
 */
export function updateTripWithReflow(tripId: string, patch: TripPatch, moves: readonly DateMove[]) {
  return db.transaction('rw', db.trips, db.items, async () => {
    await itemRepo.setDates(tripId, moves);
    return tripRepo.update(tripId, patch);
  });
}
