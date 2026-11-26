import type { LocalDate } from '@trippocket/shared';
import { useTripItems } from '../../data/hooks';
import { attachableStops } from '../../domain/bookingAttach';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { Field, inputClass } from './BookingFields';

/**
 * 투어·티켓을 기존 일정 장소에 연결 (2026-11-26 사용자 요청). ""면 지금처럼 새 일정 칸으로 넣는다.
 * 예약 날짜의 일정이 먼저 보인다
 */
export function AttachStopField({
  tripId,
  attachedItemId,
  date,
  value,
  onChange,
}: {
  tripId: string;
  /** 지금 연결된 일정 (고칠 때) */
  attachedItemId: string | undefined;
  date: LocalDate;
  value: string;
  onChange: (itemId: string) => void;
}) {
  const { t } = useTranslation();
  const items = useTripItems(tripId);
  const stops = attachableStops(items ?? [], { date, attachedItemId });
  return (
    <Field label={t('bookings.attachStop')}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">{t('bookings.attachNew')}</option>
        {stops.map((s) => (
          <option key={s.id} value={s.id}>
            {`${s.date ? formatMonthDay(s.date) : t('plan.wishlist')} ${s.title}`}
          </option>
        ))}
      </select>
    </Field>
  );
}
