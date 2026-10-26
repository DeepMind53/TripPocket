import { getTripDays, type ItineraryItem, type LocalDate } from '@trippocket/shared';
import { Printer } from 'lucide-react';
import { useParams } from 'react-router';
import { useTrip, useTripBookings, useTripItems } from '../../data/hooks';
import { lodgingForNight } from '../../domain/lodging';
import { useTranslation } from '../../i18n';
import { useTimeText } from '../../shared/hooks/useTimeText';
import { formatMonthDay, formatPeriod } from '../../shared/lib/dateFormat';
import { Button, TopBar } from '../../shared/ui';

/**
 * 실험실 "인쇄용 일정표" (사용자 요청 2026-10-26): 꾸밈 없이 날짜별 일정·숙소·예약번호를 한 장에.
 * 브라우저 인쇄로 PDF 저장 — 머리·버튼은 인쇄에서 빠진다 (styles/index.css @media print)
 */
export function PrintPage() {
  const { t } = useTranslation();
  const { time } = useTimeText();
  const { tripId } = useParams();
  const trip = useTrip(tripId);
  const items = useTripItems(tripId) ?? [];
  const bookings = useTripBookings(tripId) ?? [];
  if (!trip) return null;
  const byId = new Map(bookings.map((b) => [b.id, b]));
  const days = getTripDays(trip.startDate, trip.endDate);
  const section = (date: LocalDate | null, title: string, list: ItineraryItem[]) => (
    <section key={date ?? 'wish'} className="print-avoid-break flex flex-col gap-1">
      <h2 className="tabular border-b border-fg/40 pb-0.5 text-body-1 font-bold">{title}</h2>
      {list.length === 0 && <p className="text-caption text-fg-muted">{t('plan.emptyDay')}</p>}
      <ol className="flex flex-col">
        {list.map((i) => {
          const no = i.bookingId ? byId.get(i.bookingId)?.confirmationNo : undefined;
          return (
            <li key={i.id} className="flex gap-3 py-1 text-body-2">
              <span className="tabular w-12 shrink-0 font-semibold">{time(i.startTime) ?? ''}</span>
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">
                  {i.kind === 'note' ? (i.memo ?? i.title) : i.title}
                  {no && <span className="text-fg-sub"> · {t('print.bookingNo', { no })}</span>}
                </span>
                {i.kind !== 'note' && i.place?.address && (
                  <span className="text-caption text-fg-sub">{i.place.address}</span>
                )}
                {i.kind !== 'note' && i.memo && (
                  <span className="text-caption whitespace-pre-line text-fg-sub">{i.memo}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {date && lodgingForNight(bookings, date) && (
        <p className="text-caption text-fg-sub">
          {t('print.lodging', { name: lodgingForNight(bookings, date)!.booking.title })}
        </p>
      )}
    </section>
  );
  const wish = items.filter((i) => i.date === null);

  return (
    <div className="mx-auto min-h-dvh max-w-[720px] pb-10">
      <div className="no-print">
        <TopBar title={t('print.title')} backTo={`/trips/${trip.id}/plan`} />
      </div>
      <article className="flex flex-col gap-4 px-5 pt-2">
        <header className="flex flex-col">
          <h1 className="text-title-2">{`${trip.cover.emoji ?? ''} ${trip.title}`.trim()}</h1>
          <p className="tabular text-body-2 text-fg-sub">
            {formatPeriod(trip.startDate, trip.endDate)}
          </p>
        </header>
        <div className="no-print">
          <Button
            fullWidth
            leading={<Printer aria-hidden="true" className="size-[18px]" />}
            onClick={() => window.print()}
          >
            {t('print.action')}
          </Button>
        </div>
        {days.map((d, n) =>
          section(
            d,
            t('plan.dayHeader', { n: n + 1, date: formatMonthDay(d) }),
            items.filter((i) => i.date === d),
          ),
        )}
        {wish.length > 0 && section(null, t('plan.wishlist'), wish)}
      </article>
    </div>
  );
}
