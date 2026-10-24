import { useTimeText } from '../../shared/hooks/useTimeText';
import { nightsBetween, type Booking } from '@trippocket/shared';
import { BedDouble, Copy, Plane } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { copyText } from '../../shared/lib/clipboard';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BOOKING_ICON } from '../common/bookingKinds';

/** S-16 예약 카드. 항공 = 탑승권 모양, 숙소 = 체크인·체크아웃 (docs/05 §3 S-09) */
export function BookingCard({ booking, onOpen }: { booking: Booking; onOpen: () => void }) {
  const { t } = useTranslation();
  const b = booking;
  return (
    <li className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('bookings.edit', { title: b.title })}
        className="block w-full p-4 text-left"
      >
        {b.kind === 'flight' ? (
          <FlightTicket booking={b} />
        ) : b.kind === 'lodging' ? (
          <LodgingBody booking={b} />
        ) : (
          <BasicBody booking={b} />
        )}
      </button>
      {b.confirmationNo && (
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-line px-4 py-1.5">
          <span className="tabular text-caption text-fg-sub">
            {t('bookings.confirmationNo')}{' '}
            <strong className="font-bold text-fg">{b.confirmationNo}</strong>
          </span>
          <button
            type="button"
            aria-label={t('bookings.copyNo', { no: b.confirmationNo })}
            onClick={() => void copyText(b.confirmationNo as string, t('bookings.copied'))}
            className="flex h-10 items-center gap-1 px-1 text-caption font-semibold text-primary"
          >
            <Copy aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
    </li>
  );
}

/** 탑승권 모양 항공편 (예약 탭·일정 화면·일정 상세가 함께 씀) */
export function FlightTicket({ booking: b }: { booking: Booking }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-caption text-fg-sub">
        <span className="flex items-center gap-1.5">
          <Plane aria-hidden="true" className="size-4 text-primary" />
          {[b.provider, b.details?.flightNo].filter(Boolean).join(' ') || b.title}
        </span>
        <span className="tabular">{formatMonthDay(b.start.date)}</span>
      </div>
      <div className="tabular flex items-center gap-3">
        <Point code={b.start.place} time={b.start.time} terminal={b.details?.terminal} />
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-fg-muted" />
        <Plane aria-hidden="true" className="size-4 text-fg-muted" />
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-fg-muted" />
        <Point
          code={b.end?.place}
          time={b.end?.time}
          terminal={b.details?.arrivalTerminal}
          align="end"
        />
      </div>
      {b.details?.seat && (
        <p className="text-caption text-fg-sub">
          {t('bookings.seatValue', { seat: b.details.seat })}
        </p>
      )}
    </div>
  );
}

function Point({
  code,
  time,
  terminal,
  align = 'start',
}: {
  code: string | undefined;
  time: string | undefined;
  terminal?: string | undefined;
  align?: 'start' | 'end';
}) {
  const { time: fmt } = useTimeText();
  return (
    <span className={`flex flex-col ${align === 'end' ? 'items-end' : ''}`}>
      <span className="text-title-1 leading-none">{code || '—'}</span>
      <span className="mt-1 text-body-2 text-fg-sub">{fmt(time) ?? '--:--'}</span>
      {terminal && <span className="text-micro text-fg-muted">{terminal}</span>}
    </span>
  );
}

function LodgingBody({ booking: b }: { booking: Booking }) {
  const { time } = useTimeText();
  const { t } = useTranslation();
  const nights = b.end ? nightsBetween(b.start.date, b.end.date) : 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-body-1">
        <BedDouble aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="truncate">{b.title}</span>
        {nights > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-primary-weak px-2 py-0.5 text-micro text-primary">
            {t('bookings.nights', { n: nights })}
          </span>
        )}
      </p>
      <div className="tabular grid grid-cols-2 gap-2 text-caption">
        <span className="flex flex-col">
          <span className="text-fg-muted">{t('bookings.checkIn')}</span>
          <span className="text-body-2">
            {formatMonthDay(b.start.date)} {time(b.start.time) ?? ''}
          </span>
        </span>
        {b.end && (
          <span className="flex flex-col">
            <span className="text-fg-muted">{t('bookings.checkOut')}</span>
            <span className="text-body-2">
              {formatMonthDay(b.end.date)} {time(b.end.time) ?? ''}
            </span>
          </span>
        )}
      </div>
      {b.details?.address && (
        <p className="truncate text-caption text-fg-muted">{b.details.address}</p>
      )}
    </div>
  );
}

function BasicBody({ booking: b }: { booking: Booking }) {
  const { time } = useTimeText();
  const { t } = useTranslation();
  const Icon = BOOKING_ICON[b.kind];
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-1">{b.title}</span>
        <span className="tabular text-caption text-fg-muted">
          {t(`bookingKind.${b.kind}`)} · {formatMonthDay(b.start.date)} {time(b.start.time) ?? ''}
          {b.start.place ? ` · ${b.start.place}` : ''}
          {b.details?.partySize
            ? ` · ${t('bookings.partySizeValue', { n: b.details.partySize })}`
            : ''}
        </span>
        {b.details?.address && (
          <span className="truncate text-caption text-fg-muted">{b.details.address}</span>
        )}
      </span>
    </div>
  );
}
