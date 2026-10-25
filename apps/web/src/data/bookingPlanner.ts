import { bookingsToPlan, planDraftsFromBooking, timeSlotIndex } from '../domain/bookingPlan';
import { nowIso } from './clock';
import { bookingRepo } from './repositories/bookingRepo';
import { itemRepo } from './repositories/itemRepo';

const running = new Set<string>();

/**
 * 아직 일정표에 없는 예약을 시각에 맞는 자리에 한 번만 넣는다 (사용자 요청 2026-10-26).
 * 넣은 뒤에는 예약에 plannedAt을 남겨, 일정을 옮기거나 지워도 다시 넣지 않는다.
 * 넣은 일정 수를 돌려준다
 */
export async function placeBookingsInPlan(
  tripId: string,
  arriveLabel: (airport: string) => string,
): Promise<number> {
  if (running.has(tripId)) return 0;
  running.add(tripId);
  try {
    const [bookings, items] = await Promise.all([
      bookingRepo.listByTrip(tripId),
      itemRepo.listByTrip(tripId),
    ]);
    let added = 0;
    for (const b of bookingsToPlan(bookings, items)) {
      for (const d of planDraftsFromBooking(b, arriveLabel)) {
        const day = await itemRepo.listByDay(tripId, d.date);
        await itemRepo.create({ tripId, ...d }, timeSlotIndex(day, d.startTime));
        added++;
      }
      await bookingRepo.update(b.id, { plannedAt: nowIso() });
    }
    return added;
  } finally {
    running.delete(tripId);
  }
}
