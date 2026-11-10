import { useTimeText } from '../../shared/hooks/useTimeText';
import { InlineIcon } from '../../shared/ui/InlineIcon';
import { nightsBetween, todayIn, type Booking } from '@trippocket/shared';
import { Link } from 'react-router';
import { TICKET_NOTCH_STYLE, useTicketNotch } from '../../shared/ui/useTicketNotch';
import { useLab } from '../../data/labsStore';
import {
  BadgePercent,
  BedDouble,
  Copy,
  EggFried,
  ExternalLink,
  Luggage,
  MapPin,
  Plane,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { copyText } from '../../shared/lib/clipboard';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { BookingKindIcon } from '../common/BookingKindIcon';
import { membershipFor, useTravelProfile } from '../../data/travelProfile';
import { FlightAirportInfo } from './FlightAirportInfo';
import { BaggageInfo } from './BaggageInfo';
import { FlightDelay } from './FlightDelay';

/** S-16 예약 카드. 항공 = 탑승권 모양, 숙소 = 체크인·체크아웃 (docs/05 §3 S-09) */
export function BookingCard({
  booking,
  onOpen,
  highlight = false,
}: {
  booking: Booking;
  onOpen: () => void;
  /** 빠른 메뉴 바우처에서 눌러 온 예약 — 테두리로 표시 */
  highlight?: boolean;
}) {
  const { t } = useTranslation();
  const b = booking;
  const priceLab = useLab('lodgingPrice');
  // 마이 → 개인정보의 항공사 회원번호 (예약 항공사·편명과 맞을 때, 2026-11-02)
  const member = useTravelProfile((p) =>
    b.kind === 'flight'
      ? membershipFor(p.memberships, { provider: b.provider, flightNo: b.details?.flightNo })
      : undefined,
  );
  const ticket = b.kind === 'flight' || b.kind === 'train';
  // 탑승권 양 끝 반원 홈: 카드를 실제로 도려낸다 (마스크) — 구멍을 덧그리면 카드 테두리 선이 홈 안에 남는다 (사용자 제보 2026-11-10).
  // 홈 높이 = 절취선 위치라 실제 위치를 재서 --perf-y로
  const { cardRef, perfRef } = useTicketNotch<HTMLLIElement, HTMLDivElement>();
  return (
    <li
      ref={cardRef}
      id={`booking-${b.id}`}
      style={ticket ? TICKET_NOTCH_STYLE : undefined}
      className={`relative overflow-hidden rounded-card border bg-surface shadow-card [&>[data-perf]+*]:border-t-transparent [&>[data-perf]:last-child]:hidden ${highlight ? 'border-primary ring-2 ring-primary' : 'border-line'}`}
    >
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
      {/* 탑승권 절취선 (docs/29 §4.5, 사용자 결정 Q11: 항공·기차·버스만) — 양 끝 홈은 위 마스크가 도려낸다.
          바로 아래 줄의 점선 위 테두리는 이 선과 겹치지 않게 숨긴다 */}
      {ticket && (
        <div
          ref={perfRef}
          data-perf=""
          aria-hidden="true"
          className="mx-4 border-t-[1.5px] border-dashed border-line"
        />
      )}
      {b.details?.voucherUrl && (
        <div className="flex justify-end border-t border-dashed border-line px-4">
          <a
            href={b.details.voucherUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center gap-1 text-caption font-semibold text-primary"
          >
            {t('bookings.voucherOpen')}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      )}
      {/* 실험실 "숙소 최저가": 이 숙소 이름·날짜로 아고다 경로별·예약 앱 링크 (docs/28 Q5) */}
      {b.kind === 'lodging' && priceLab && (
        <div className="flex justify-end border-t border-dashed border-line px-4">
          <Link
            to={`/lodging-price?trip=${b.tripId}&booking=${b.id}`}
            className="flex h-10 items-center gap-1 text-caption font-semibold text-primary"
          >
            <BadgePercent aria-hidden="true" className="size-4" />
            {t('lodgingPrice.button')}
          </Link>
        </div>
      )}
      {b.kind === 'flight' && <FlightAirportInfo booking={b} />}
      {b.kind === 'flight' && <FlightDelay booking={b} />}
      {b.kind === 'flight' && <BaggageInfo booking={b} />}
      {member && (
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-line px-4 py-1.5">
          <span className="tabular min-w-0 truncate text-caption text-fg-sub">
            {t('bookings.member')}{' '}
            <strong className="font-mono font-medium tracking-wide text-fg">{member.number}</strong>
            {member.tier && ` · ${member.tier}`}
          </span>
          <button
            type="button"
            aria-label={t('bookings.copyMember', { no: member.number })}
            onClick={() => void copyText(member.number, t('bookings.copied'))}
            className="flex h-10 items-center gap-1 px-1 text-caption font-semibold text-primary"
          >
            <Copy aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
      {b.confirmationNo && (
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-line px-4 py-1.5">
          <span className="tabular text-caption text-fg-sub">
            {t('bookings.confirmationNo')}{' '}
            <strong className="font-mono font-medium tracking-wide whitespace-nowrap text-primary">
              {b.confirmationNo}
            </strong>
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
      {(b.details?.seat || b.details?.baggage) && (
        <p className="text-caption text-fg-sub">
          {b.details.baggage && !b.details.seat && <InlineIcon icon={Luggage} />}
          {[
            b.details.seat && t('bookings.seatValue', { seat: b.details.seat }),
            b.details.baggage && t('bookings.baggageValue', { v: b.details.baggage }),
          ]
            .filter(Boolean)
            .join(' · ')}
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
      <span className="font-mono text-[28px] leading-none font-medium tracking-tight">
        {code || '—'}
      </span>
      <span className="mt-1 text-body-2 text-fg-sub">{fmt(time) ?? '--:--'}</span>
      {terminal && <span className="text-micro text-fg-muted">{terminal}</span>}
    </span>
  );
}

export function LodgingBody({ booking: b }: { booking: Booking }) {
  const { time } = useTimeText();
  const { t } = useTranslation();
  const nights = b.end ? nightsBetween(b.start.date, b.end.date) : 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-body-1">
        <BedDouble aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="line-clamp-2">{b.title}</span>
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
      {/* 조식 있음·없음을 한눈에 (사용자 요청 2026-10-26) */}
      {b.details?.breakfast ? (
        <p className="self-start rounded-full bg-primary-weak px-2 py-0.5 text-caption font-semibold text-primary">
          <InlineIcon icon={EggFried} className="text-current" />
          {b.details.breakfastDates
            ? t('bookings.breakfastSome', {
                days: b.details.breakfastDates.map(formatMonthDay).join(', '),
              })
            : t('bookings.breakfastAll')}
        </p>
      ) : (
        <p className="self-start rounded-full bg-bg-subtle px-2 py-0.5 text-caption text-fg-sub">
          {t('bookings.noBreakfast')}
        </p>
      )}
      {(b.details?.roomType || b.details?.partySize) && (
        <p className="truncate text-caption text-fg-sub">
          {[
            b.details.roomType,
            b.details.partySize && t('bookings.partySizeValue', { n: b.details.partySize }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {b.details?.address && (
        <p className="truncate text-caption text-fg-muted">{b.details.address}</p>
      )}
      <BookingExtras booking={b} />
    </div>
  );
}

/** "12월23일 (목요일)" */
const longDay = (date: string) => {
  const [, m, d] = date.split('-').map(Number);
  const wd = new Intl.DateTimeFormat('ko', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
  return `${m}월${d}일 (${wd})`;
};

/**
 * 기차·버스 (사용자 요청 2026-11-03):
 * KTX 12월23일 (목요일)
 * 동대구역 13:32 ┈┈ 수원역 15:44  ← 탑승권 모양 (docs/29 §4.5, 사용자 결정 Q11 2026-11-09): 역 이름 크게, 시각은 아래
 */
export function TrainTicket({ booking: b }: { booking: Booking }) {
  const { time } = useTimeText();
  const end = (place: string | undefined, at: string | undefined, align: 'start' | 'end') => (
    <span className={`flex min-w-0 flex-col ${align === 'end' ? 'items-end text-right' : ''}`}>
      <span className="line-clamp-2 text-title-2">{place || '—'}</span>
      <span className="tabular text-body-2 text-fg-sub">{time(at) ?? '--:--'}</span>
    </span>
  );
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-start gap-1.5">
        <BookingKindIcon booking={b} className="mt-1 size-4 shrink-0 text-primary" />
        <span className="text-body-1">
          {b.title} <span className="tabular">{longDay(b.start.date)}</span>
        </span>
      </span>
      {(b.start.place || b.end?.place) && (
        <span className="flex items-end gap-3">
          {end(b.start.place, b.start.time, 'start')}
          {b.end && (
            <>
              <span
                aria-hidden="true"
                className="mb-3 h-px min-w-6 flex-1 border-t border-dashed border-fg-muted"
              />
              {end(b.end.place, b.end.time, 'end')}
            </>
          )}
        </span>
      )}
      {b.details?.seat && <span className="text-caption text-fg-sub">{b.details.seat}</span>}
      <BookingExtras booking={b} />
    </div>
  );
}

function BasicBody({ booking: b }: { booking: Booking }) {
  const { time } = useTimeText();
  const { t } = useTranslation();
  if (b.kind === 'train') return <TrainTicket booking={b} />;
  return (
    <div className="flex items-start gap-3">
      <BookingKindIcon booking={b} className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-1">{b.title}</span>
        <span className="tabular text-caption text-fg-muted">
          {t(`bookingKind.${b.kind}`)} · {formatMonthDay(b.start.date)} {time(b.start.time) ?? ''}
          {b.start.place ? ` · ${b.start.place}` : ''}
          {b.details?.partySize
            ? ` · ${t('bookings.partySizeValue', { n: b.details.partySize })}`
            : ''}
        </span>
        {b.kind === 'car' && b.end && (
          <span className="tabular truncate text-caption text-fg-sub">
            {t('bookings.returnValue', {
              when: [formatMonthDay(b.end.date), time(b.end.time), b.end.place]
                .filter(Boolean)
                .join(' '),
            })}
          </span>
        )}
        {b.details?.address && (
          <span className="truncate text-caption text-fg-muted">{b.details.address}</span>
        )}
        {b.details?.meetingPoint && (
          <span className="truncate text-caption text-fg-sub">
            <InlineIcon icon={MapPin} />
            {t('bookings.meetingValue', { v: b.details.meetingPoint })}
          </span>
        )}
        {b.details?.insurance && (
          <span className="truncate text-caption text-fg-sub">
            <InlineIcon icon={ShieldCheck} />
            {t('bookings.insuranceValue', { v: b.details.insurance })}
          </span>
        )}
        <BookingExtras booking={b} />
      </span>
    </div>
  );
}

/** 결제 상태·무료 취소 마감 (2026-10-28) — 마감이 지나면 흐리게 */
function BookingExtras({ booking: b }: { booking: Booking }) {
  const { t } = useTranslation();
  const d = b.details;
  if (!d?.payment && !d?.cancelBy) return null;
  const passed =
    !!d.cancelBy && d.cancelBy < todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {d.payment && (
        <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-micro text-fg-sub">
          {t(`bookings.paymentValue.${d.payment}`)}
        </span>
      )}
      {d.cancelBy && (
        <span
          className={
            passed
              ? 'rounded-full bg-bg-subtle px-2 py-0.5 text-micro text-fg-muted'
              : 'tabular rounded-full bg-success/10 px-2 py-0.5 text-micro text-success'
          }
        >
          {passed
            ? t('bookings.cancelPassed')
            : t('bookings.cancelByValue', { date: formatMonthDay(d.cancelBy) })}
        </span>
      )}
    </span>
  );
}
