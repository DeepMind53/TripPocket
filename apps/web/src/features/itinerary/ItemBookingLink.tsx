import type { ItineraryItem } from '@trippocket/shared';
import { Ticket } from 'lucide-react';
import { attachBooking, detachBooking } from '../../data/bookingAttach';
import { useTripBookings } from '../../data/hooks';
import { attachableBookings } from '../../domain/bookingAttach';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';

/**
 * 일정 상세에서 투어·티켓 예약 연결 (2026-11-26 사용자 요청). 일정은 이름·시간·장소 그대로, 예약 표시만 붙는다.
 * "" = 연결 안 함 (끊어도 일정표에 새 칸은 만들지 않는다)
 */
export function ItemBookingLink({
  item,
  linkedId,
}: {
  item: Pick<ItineraryItem, 'id' | 'tripId'>;
  /** 지금 이 일정에 연결된 예약 */
  linkedId: string | undefined;
}) {
  const { t } = useTranslation();
  const bookings = attachableBookings(useTripBookings(item.tripId) ?? [], item.id);
  if (bookings.length === 0 && !linkedId) return null;
  const change = async (next: string) => {
    if (linkedId && linkedId !== next) await detachBooking(linkedId, false);
    if (next) await attachBooking(next, item.id);
  };
  return (
    <label className="flex items-center gap-2 rounded-btn bg-bg-subtle px-3">
      <Ticket aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
      <span className="shrink-0 text-body-2 text-fg-sub">{t('detail.linkBooking')}</span>
      <select
        value={linkedId ?? ''}
        onChange={(e) => void change(e.target.value)}
        className="h-11 min-w-0 flex-1 bg-transparent text-right text-body-2 outline-none"
      >
        <option value="">{t('detail.linkNone')}</option>
        {bookings.map((b) => (
          <option key={b.id} value={b.id}>
            {`${formatMonthDay(b.start.date)} ${b.title}`}
          </option>
        ))}
      </select>
    </label>
  );
}
