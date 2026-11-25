import type { Booking, ItineraryItem, LocalDate } from '@trippocket/shared';
import { useState } from 'react';
import { bookingRowsForDay, lodgingForNight } from '../../domain/lodging';
import { mapPointsParam, weatherText, type PrintWeather } from '../../domain/dayPrint';
import { useTranslation } from '../../i18n';
import { DAY_LINE_HEX } from '../../shared/ui/routeColor';
import { BOOKING_ICON } from '../common/bookingKinds';

/**
 * 일정표 출력 하루 (2026-11-25 사용자 요청): 날짜 옆 날씨·현지 공휴일, 간단 = 지금 모양,
 * 상세 = 해 뜨고 지는 시각 · 일차 지도(Google 정적 지도) · 그날 예약 · 시간·장소·주소·메모·예약번호 · 숙소 체크인/아웃.
 * 번호는 일정 화면 목록과 같다 (메모도 센다)
 */
export function PrintDay({
  date,
  title,
  dayIndex,
  items,
  bookings,
  weather,
  holiday,
  sun,
  detail,
  time,
}: {
  date: LocalDate | null;
  title: string;
  dayIndex: number;
  items: readonly ItineraryItem[];
  bookings: readonly Booking[];
  weather?: PrintWeather | undefined;
  holiday?: string | undefined;
  sun?: { rise: string; set: string } | null | undefined;
  detail: boolean;
  time: (t: string | undefined) => string | undefined;
}) {
  const { t } = useTranslation();
  const byId = new Map(bookings.map((b) => [b.id, b]));
  const lodging = date ? lodgingForNight(bookings, date) : null;
  // 그날 체크아웃하는 숙소 (상세)
  const checkout = date
    ? bookings.find((b) => b.kind === 'lodging' && b.end?.date === date)
    : undefined;
  const rows = date && detail ? bookingRowsForDay(bookings, date) : [];
  const points = date && detail ? mapPointsParam(items) : null;
  const [mapFailed, setMapFailed] = useState(false);
  const weatherLine = weatherText(weather);
  const color = DAY_LINE_HEX[dayIndex % DAY_LINE_HEX.length]!.slice(1);

  return (
    <section className={detail ? 'flex flex-col gap-2' : 'print-avoid-break flex flex-col gap-1'}>
      <h2 className="tabular flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-fg/40 pb-0.5">
        <span className="text-body-1 font-semibold">{title}</span>
        {weatherLine && <span className="text-caption text-fg-sub">{weatherLine}</span>}
        {holiday && (
          <span className="text-caption font-medium text-danger">
            {t('print.holiday', { name: holiday })}
          </span>
        )}
      </h2>
      {detail && sun && (
        <p className="tabular text-caption text-fg-sub">
          {t('print.sun', { rise: sun.rise, set: sun.set })}
        </p>
      )}
      {points && !mapFailed && (
        // 일차 지도 — 서버가 Google 정적 지도를 받아 넘긴다 (못 받으면 지도 없이)
        <img
          src={`/api/maps/static?p=${encodeURIComponent(points)}&c=${color}`}
          alt={t('print.mapAlt', { day: title })}
          onError={() => setMapFailed(true)}
          className="print-avoid-break w-full rounded-chip border border-line"
        />
      )}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-0.5 rounded-chip bg-bg-subtle px-3 py-2 text-caption">
          {rows.map((r) => {
            const Icon = BOOKING_ICON[r.booking.kind];
            const d = r.booking.details;
            return (
              <li key={`${r.booking.id}-${r.part}`} className="flex items-start gap-1.5">
                <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <span className="tabular">
                  {[
                    time(r.time),
                    r.booking.title,
                    r.part === 'arrive' ? t('print.arrive') : '',
                    r.part !== 'arrive' && d?.terminal ? d.terminal : '',
                    r.booking.confirmationNo
                      ? t('print.bookingNo', { no: r.booking.confirmationNo })
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {items.length === 0 && <p className="text-caption text-fg-muted">{t('plan.emptyDay')}</p>}
      <ol className="flex flex-col">
        {items.map((i, idx) => {
          const b = i.bookingId ? byId.get(i.bookingId) : undefined;
          const range =
            detail && i.startTime && i.endTime
              ? `${time(i.startTime)}–${time(i.endTime)}`
              : (time(i.startTime) ?? '');
          return (
            <li
              key={i.id}
              className={
                detail
                  ? 'print-avoid-break flex gap-2 border-b border-line py-1.5 text-body-2 last:border-b-0'
                  : 'flex gap-3 py-1 text-body-2'
              }
            >
              {detail && <span className="tabular w-5 shrink-0 text-fg-sub">{idx + 1}</span>}
              <span className={`tabular shrink-0 font-semibold ${detail ? 'w-24' : 'w-12'}`}>
                {range}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">
                  {i.kind === 'note' ? (i.memo ?? i.title) : i.title}
                  {b?.confirmationNo && (
                    <span className="text-fg-sub">
                      {' · '}
                      {t('print.bookingNo', { no: b.confirmationNo })}
                    </span>
                  )}
                </span>
                {i.kind !== 'note' && i.place?.address && (
                  <span className="text-caption text-fg-sub">{i.place.address}</span>
                )}
                {i.kind !== 'note' && i.memo && (
                  <span className="text-caption whitespace-pre-line text-fg-sub">{i.memo}</span>
                )}
                {detail && b?.details?.phone && (
                  <span className="tabular text-caption text-fg-sub">{b.details.phone}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {detail && checkout && checkout.id !== lodging?.booking.id && (
        <p className="text-caption text-fg-sub">
          {t('print.checkout', {
            name: checkout.title,
            time: time(checkout.end?.time) ?? '',
          }).trim()}
        </p>
      )}
      {lodging && (
        <p className="text-caption text-fg-sub">
          {t('print.lodging', { name: lodging.booking.title })}
          {detail && lodging.booking.details?.address && ` · ${lodging.booking.details.address}`}
          {detail &&
            lodging.booking.start.date === date &&
            lodging.booking.start.time &&
            ` · ${t('print.checkin', { time: time(lodging.booking.start.time) ?? '' })}`}
        </p>
      )}
    </section>
  );
}
