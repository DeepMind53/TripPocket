import type { Booking, Trip } from '@trippocket/shared';
import { useLab } from '../../data/labsStore';
import { isLeftDrive, onsiteBookings } from '../../domain/localInfo';
import { tripCountries } from '../../domain/tripPlace';
import { useTranslation } from '../../i18n';

const countryName = (cc: string) => {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
};

/**
 * 예약 탭 위 안내 (실험실 3차, 2026-10-28):
 * - 좌측 통행: 렌터카 예약이 있고 여행 나라가 좌측 통행이면
 * - 현장 결제 모아보기: 결제 상태가 "현장 결제"인 예약 수와 이름
 */
export function BookingNotices({ trip, bookings }: { trip: Trip; bookings: readonly Booking[] }) {
  const { t } = useTranslation();
  const leftOn = useLab('leftDrive');
  const payOn = useLab('onsitePay');
  const left =
    leftOn && bookings.some((b) => b.kind === 'car' && !b.deletedAt)
      ? tripCountries(trip).filter(isLeftDrive)
      : [];
  const onsite = payOn ? onsiteBookings(bookings) : [];
  if (!left.length && !onsite.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {left.length > 0 && (
        <p className="rounded-btn bg-warning/10 px-3 py-2 text-caption whitespace-pre-line text-fg-sub">
          {t('labs.leftDrive', { country: left.map(countryName).join('·') })}
        </p>
      )}
      {onsite.length > 0 && (
        <p className="flex flex-col rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
          <span className="whitespace-pre-line">{t('labs.onsitePay', { n: onsite.length })}</span>
          <span className="truncate text-fg-muted">{onsite.map((b) => b.title).join(', ')}</span>
        </p>
      )}
    </div>
  );
}
