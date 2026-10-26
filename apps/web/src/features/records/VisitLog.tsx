import { flagEmoji, type Trip } from '@trippocket/shared';
import { useVisitedItems } from '../../data/hooks';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { KIND_ICON } from '../itinerary/itemKinds';

/**
 * 실험실 "방문 기록" (사용자 요청 2026-10-26): 일정 화면에서 누른 방문·미방문을 모아 보여 준다.
 * 기기 DB만 읽는다 (동기화되면 다른 기기 기록도 함께)
 */
export function VisitLog({ trips }: { trips: readonly Trip[] }) {
  const { t } = useTranslation();
  const items = useVisitedItems();
  if (!items) return null;
  const tripById = new Map(trips.map((tr) => [tr.id, tr]));
  const visited = items.filter((i) => i.visit === 'visited').length;
  const byTrip = new Map<string, typeof items>();
  for (const i of items) byTrip.set(i.tripId, [...(byTrip.get(i.tripId) ?? []), i]);
  const groups = [...byTrip]
    .map(([id, list]) => ({
      trip: tripById.get(id),
      list: [...list].sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : 1)),
    }))
    .sort((a, b) => ((a.trip?.startDate ?? '') < (b.trip?.startDate ?? '') ? 1 : -1));
  const skipped = items.length - visited;
  return (
    <section aria-label={t('visit.logTitle')} className="flex flex-col gap-2">
      <h2 className="text-caption font-bold text-fg-muted">{t('visit.logTitle')}</h2>
      <p className="tabular text-body-2 text-fg-sub">
        {t('visit.logCounts', { visited, skipped })}
      </p>
      {items.length === 0 ? (
        <p className="text-body-2 text-fg-muted">{t('visit.logEmpty')}</p>
      ) : (
        // 여행 기간별로 묶어서 (사용자 요청 2026-10-27) — 최근 여행 먼저
        groups.map(({ trip, list }) => {
          const country = trip?.destinations.find((d) => d.countryCode)?.countryCode;
          const seen = list.filter((i) => i.visit === 'visited').length;
          return (
            <section
              key={trip?.id ?? 'unknown'}
              aria-label={trip?.title ?? ''}
              className="flex flex-col gap-1"
            >
              <h3 className="tabular flex items-baseline gap-1.5 text-caption">
                <span className="font-semibold text-fg-sub">
                  {country ? `${flagEmoji(country)} ` : ''}
                  {trip?.title ?? ''}
                </span>
                {trip && (
                  <span className="text-fg-muted">
                    {trip.startDate.slice(2).replace(/-/g, '.')}–
                    {trip.endDate.slice(5).replace(/-/g, '.')}
                  </span>
                )}
                <span className="ml-auto text-fg-muted">
                  {t('visit.logCounts', { visited: seen, skipped: list.length - seen })}
                </span>
              </h3>
              <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
                {list.map((i) => {
                  const Icon = KIND_ICON[i.kind];
                  return (
                    <li key={i.id} className="flex items-center gap-3 px-3 py-2">
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-sub" />
                      <span className="min-w-0 flex-1 truncate text-body-2">{i.title}</span>
                      <span className="tabular shrink-0 text-micro text-fg-muted">
                        {i.date?.slice(5).replace('-', '.')}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold',
                          i.visit === 'visited'
                            ? 'bg-primary-weak text-primary'
                            : 'bg-bg-subtle text-fg-muted',
                        )}
                      >
                        {t(`visit.button.${i.visit!}`)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </section>
  );
}
