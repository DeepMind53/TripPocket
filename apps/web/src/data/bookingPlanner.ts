import {
  bookingsToPlan,
  draftPatch,
  pairDrafts,
  planDraftsFromBooking,
  timeSlotIndex,
} from '../domain/bookingPlan';
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

/**
 * 예약을 고치면 이미 일정표에 들어간 그 예약 일정도 맞춘다 (사용자 요청 2026-10-26).
 * 제목·시각·장소·이동 정보를 덮어쓰고, 날짜가 바뀌면 새 날의 시각 자리로 옮긴다.
 * 메모·다녀옴·방문 기록은 그대로, 사용자가 지운 일정은 다시 만들지 않는다. 바꾼 일정 수를 돌려준다
 */
export async function syncBookingToPlan(
  bookingId: string,
  arriveLabel: (airport: string) => string,
): Promise<number> {
  const booking = await bookingRepo.get(bookingId);
  if (!booking || !booking.plannedAt) return 0;
  const linked = (await itemRepo.listByTrip(booking.tripId)).filter(
    (i) => i.bookingId === bookingId,
  );
  const pairs = pairDrafts(linked, planDraftsFromBooking(booking, arriveLabel));
  for (const { item, draft } of pairs) {
    await itemRepo.update(item.id, draftPatch(item, draft));
    if (item.date !== draft.date) {
      const day = (await itemRepo.listByDay(booking.tripId, draft.date)).filter(
        (i) => i.id !== item.id,
      );
      await itemRepo.move(item.id, draft.date, timeSlotIndex(day, draft.startTime));
    }
  }
  return pairs.length;
}
