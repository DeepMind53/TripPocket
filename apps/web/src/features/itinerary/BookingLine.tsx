import { useTimeText } from '../../shared/hooks/useTimeText';
import { useTranslation } from '../../i18n';
import { type BookingRow } from '../../domain/lodging';
import { cn } from '../../shared/lib/cn';
import { BookingKindIcon } from '../common/BookingKindIcon';
import { FlightTicket, TrainTicket } from '../bookings/BookingCard';

export function BookingLine({ row, onOpen }: { row: BookingRow; onOpen: () => void }) {
  const { time, wide } = useTimeText();
  const { t } = useTranslation();
  const b = row.booking;
  const route =
    (b.kind === 'flight' || b.kind === 'transfer') && (b.start.place || b.end?.place)
      ? `${b.start.place ?? ''} → ${b.end?.place ?? ''}`
      : null;
  // 출발하는 날의 항공편·기차·버스는 예약 탭과 같은 표 모양으로 (편명·역·시각·좌석·예약번호)
  if ((b.kind === 'flight' || b.kind === 'train') && row.part === 'start')
    return (
      <li>
        <button
          type="button"
          onClick={onOpen}
          aria-label={t('plan.openBooking', { title: b.title })}
          className="flex w-full flex-col gap-2 rounded-btn border border-dashed border-line px-3 py-3 text-left"
        >
          {b.kind === 'train' ? <TrainTicket booking={b} /> : <FlightTicket booking={b} />}
          {b.confirmationNo && (
            <span className="tabular border-t border-dashed border-line pt-1.5 text-caption text-fg-sub">
              {t('bookings.confirmationNo')}{' '}
              <strong className="font-semibold text-fg">{b.confirmationNo}</strong>
            </span>
          )}
        </button>
      </li>
    );
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('plan.openBooking', { title: b.title })}
        className="flex w-full items-center gap-3 rounded-btn border border-dashed border-line px-2 py-2 text-left"
      >
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-weak text-primary"
        >
          <BookingKindIcon booking={b} className="size-3.5" />
        </span>
        <span className={cn('tabular shrink-0 text-caption text-fg-sub', wide ? 'w-16' : 'w-11')}>
          {time(row.time) ?? '—'}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-2 font-medium">
            {row.part === 'arrive' && `${t('plan.arrive')} · `}
            {b.title}
            {/* 공항 픽업·드랍은 예약처를 제목 옆에 (사용자 요청 2026-10-27) */}
            {b.kind === 'transfer' && b.provider && (
              <span className="font-normal text-fg-sub"> ({b.provider})</span>
            )}
          </span>
          {(route || b.confirmationNo) && (
            <span className="tabular truncate text-caption text-fg-muted">
              {[route, b.confirmationNo].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <span className="shrink-0 rounded-md bg-bg-subtle px-1.5 py-0.5 text-micro text-fg-sub">
          {t(`bookingKind.${b.kind}`)}
        </span>
      </button>
    </li>
  );
}

/** 실험실 "빠듯한 일정 알림": 걸어서 걸리는 시간이 두 일정 시각 차이보다 길 때 */

/** 실험실 "다음 장소까지 거리": 두 일정 모두 좌표가 있을 때만 직선거리·도보 어림 */
