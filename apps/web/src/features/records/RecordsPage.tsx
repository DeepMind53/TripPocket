import { flagEmoji, getTripStatus, nightsBetween, todayIn } from '@trippocket/shared';
import { Link } from 'react-router';
import { useTrips } from '../../data/hooks';
import { useTranslation } from '../../i18n';
import { EmptyState, TopBar } from '../../shared/ui';
import { TripList } from '../trips/TripsPage';
import { TravelReview } from './TravelReview';
import { VisitLog } from './VisitLog';

/**
 * 기록 탭 (2026-10-24 사용자 선택): 다녀온 여행 모음 + 나의 여행 통계(여행 횟수·여행한 날·가 본 나라).
 * 기기 DB의 여행만으로 계산 (서버 호출 없음)
 */
export function RecordsPage() {
  const { t } = useTranslation();
  const trips = useTrips();
  const past = (trips ?? []).filter(
    (tr) => getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone)) === 'past',
  );
  const days = past.reduce((sum, tr) => sum + nightsBetween(tr.startDate, tr.endDate) + 1, 0);
  const countries = [
    ...new Set(
      past.flatMap((tr) => tr.destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []))),
    ),
  ];

  return (
    <>
      <TopBar title={t('records.title')} />
      <div className="flex flex-col gap-6 px-5 pt-2">
        <section aria-label={t('records.stats')} className="flex flex-col gap-3">
          <h2 className="text-caption font-bold text-fg-muted">{t('records.stats')}</h2>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('records.trips')} value={t('records.tripsN', { n: past.length })} />
            <Stat label={t('records.days')} value={t('records.daysN', { n: days })} />
            <Stat
              label={t('records.countries')}
              value={t('records.countriesN', { n: countries.length })}
            />
          </div>
          {countries.length > 0 && (
            <p
              className="flex flex-wrap gap-1 text-[28px] leading-none"
              aria-label={countries.join(', ')}
            >
              {countries.map((c) => (
                <span key={c} aria-hidden="true">
                  {flagEmoji(c)}
                </span>
              ))}
            </p>
          )}
        </section>

        <TravelReview pastTrips={past} />
        <VisitLog trips={trips ?? []} />

        <section aria-label={t('records.pastTitle')} className="flex flex-col gap-2">
          <h2 className="text-caption font-bold text-fg-muted">{t('records.pastTitle')}</h2>
          {trips && past.length === 0 ? (
            <EmptyState
              emoji="📔"
              title={t('records.empty')}
              description={t('records.emptyDesc')}
            />
          ) : null}
        </section>
      </div>
      {past.length > 0 && <TripList only="past" />}
      <Link
        to="/trips"
        className="mx-auto mt-4 block w-fit py-2 text-body-2 font-semibold text-fg-sub"
      >
        {t('records.allTrips')}
      </Link>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-card bg-bg-subtle py-3">
      <span className="tabular text-title-2">{value}</span>
      <span className="text-caption text-fg-muted">{label}</span>
    </div>
  );
}
