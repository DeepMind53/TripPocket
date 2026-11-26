import { nowIso } from './clock';
import { bookingRepo } from './repositories/bookingRepo';
import { itemRepo } from './repositories/itemRepo';

/**
 * 투어·티켓 예약을 기존 일정에 연결 (2026-11-26 사용자 요청 "기존 일정에 있는 장소와 연결").
 * - 그 일정은 이름·시간·장소를 그대로 두고 예약 표시만 붙는다 (item.bookingId)
 * - 예약이 일정표에 따로 만든 칸이 있으면 휴지통으로 (같은 곳이 두 줄이 되지 않게, 삭제 기록에서 되살림)
 * - 예약에 plannedAt을 남겨 새 칸을 다시 만들지 않는다
 */
export async function attachBooking(bookingId: string, itemId: string): Promise<void> {
  const booking = await bookingRepo.get(bookingId);
  if (!booking) return;
  const items = await itemRepo.listByTrip(booking.tripId);
  for (const i of items) {
    if (i.bookingId !== bookingId || i.id === itemId) continue;
    // 예전에 연결했던 기존 일정은 표시만 떼고, 예약이 만든 칸은 휴지통으로
    if (i.id === booking.attachedItemId) await itemRepo.update(i.id, { bookingId: undefined });
    else await itemRepo.softDelete(i.id);
  }
  await itemRepo.update(itemId, { bookingId });
  await bookingRepo.update(bookingId, {
    attachedItemId: itemId,
    plannedAt: booking.plannedAt ?? nowIso(),
  });
}

/**
 * 연결 끊기. asNewStop이면 예약을 새 일정 칸으로 다시 넣게 한다(일정 화면을 열 때 시각 자리에).
 * 아니면 일정표에 따로 칸을 만들지 않는다 (일정 상세에서 끊을 때)
 */
export async function detachBooking(bookingId: string, asNewStop: boolean): Promise<void> {
  const booking = await bookingRepo.get(bookingId);
  if (!booking?.attachedItemId) return;
  const item = await itemRepo.get(booking.attachedItemId);
  if (item?.bookingId === bookingId) await itemRepo.update(item.id, { bookingId: undefined });
  await bookingRepo.update(bookingId, {
    attachedItemId: undefined,
    ...(asNewStop ? { plannedAt: undefined } : {}),
  });
}
