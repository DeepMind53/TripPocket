import { getTripDays, type PublicTrip } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { shareApi } from '../../data/api/share';
import { useTranslation } from '../../i18n';
import { useTimeText } from '../../shared/hooks/useTimeText';
import { formatMonthDay, formatPeriod } from '../../shared/lib/dateFormat';
import { EmptyState, Spinner } from '../../shared/ui';

/**
 * S-40 보기 전용 공유 일정 — 로그인 없이, 기기에 저장하지 않고 화면에만 보여 준다
 */
export function PublicTripPage() {
  const { t } = useTranslation();
  const { shareId = '' } = useParams();
  const { time } = useTimeText();
  const [data, setData] = useState<PublicTrip | null | undefined>(undefined);

  useEffect(() => {
    void shareApi.view(shareId).then((r) => setData(r.ok ? r.data : null));
  }, [shareId]);

  if (data === undefined)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  if (data === null)
    return (
      <EmptyState
        emoji="🔗"
        title={t('share.publicGone')}
        description={t('share.publicGoneDesc')}
        action={
          <Link to="/" className="font-semibold text-primary">
            {t('share.openApp')}
          </Link>
        }
      />
    );

  const { trip, items, bookings } = data;
  const days = getTripDays(trip.startDate, trip.endDate);
  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <header className="bg-primary px-5 pt-8 pb-6 text-on-primary">
        <p className="text-caption opacity-80">{t('share.publicBadge')}</p>
        <h1 className="text-title-1">
          {trip.cover.emoji} {trip.title}
        </h1>
        <p className="tabular text-body-2 opacity-90">
          {formatPeriod(trip.startDate, trip.endDate)}
        </p>
      </header>
      <div className="flex flex-col gap-4 px-5 pt-4">
        {days.map((date, i) => {
          const day = items
            .filter((it) => it.date === date)
            .sort((a, b) => (a.order < b.order ? -1 : 1));
          const bk = bookings.filter((b) => b.start.date === date);
          if (day.length === 0 && bk.length === 0) return null;
          return (
            <section key={date} className="overflow-hidden rounded-2xl border border-line">
              <h2 className="tabular bg-bg-subtle px-4 py-2.5 text-body-1 font-bold">
                {t('plan.dayN', { n: i + 1 })} · {formatMonthDay(date)}
              </h2>
              <ul className="flex flex-col divide-y divide-line px-4">
                {bk.map((b) => (
                  <li key={b.id} className="flex gap-3 py-3 text-body-2">
                    <span className="tabular w-16 shrink-0 text-caption text-fg-sub">
                      {time(b.start.time) ?? ''}
                    </span>
                    <span className="flex-1">
                      {b.title}{' '}
                      <span className="text-caption text-fg-muted">
                        · {t(`bookingKind.${b.kind}`)}
                      </span>
                    </span>
                  </li>
                ))}
                {day.map((it) => (
                  <li key={it.id} className="flex gap-3 py-3 text-body-2">
                    <span className="tabular w-16 shrink-0 text-caption text-fg-sub">
                      {time(it.startTime) ?? ''}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      {it.title}
                      {it.place?.address && (
                        <span className="truncate text-caption text-fg-muted">
                          {it.place.address}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <Link to="/" className="mt-2 text-center text-caption font-semibold text-primary">
          {t('share.madeWith')}
        </Link>
      </div>
    </div>
  );
}
