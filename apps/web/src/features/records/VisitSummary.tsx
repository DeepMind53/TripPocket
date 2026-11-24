import { flagEmoji, type Trip } from '@trippocket/shared';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useVisitedItems } from '../../data/hooks';
import { groupByTrip, visitCity } from '../../domain/visitLog';
import { useTranslation } from '../../i18n';

/** 기록 탭에 보이는 최근 여행 수 — 나머지는 [전체 보기] */
const SHOWN = 3;

/**
 * 기록 탭 "방문 기록" 요약 (사용자 결정 2026-11-24, docs/32 §1): 합계 한 줄 + 최근 여행 3줄.
 * 누르면 /records/visits — 여행 줄은 그 여행을 펼친 채로
 */
export function VisitSummary({ trips }: { trips: readonly Trip[] }) {
  const { t } = useTranslation();
  const items = useVisitedItems();
  const byId = useMemo(() => new Map(trips.map((tr) => [tr.id, tr])), [trips]);
  if (!items) return null;
  const visited = items.filter((i) => i.visit === 'visited').length;
  const cities = new Set(
    items.flatMap((i) => {
      const c = visitCity(i, byId.get(i.tripId));
      return c ? [c.key] : [];
    }),
  ).size;
  const groups = groupByTrip(items, byId).slice(0, SHOWN);
  return (
    <section aria-label={t('visit.logTitle')} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-body-1 font-semibold">{t('visit.logTitle')}</h2>
        {items.length > 0 && (
          <Link
            to="/records/visits"
            className="flex h-9 items-center gap-0.5 text-caption font-medium text-fg-sub"
          >
            {t('visit.allLink')}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-body-2 whitespace-pre-line text-fg-muted">{t('visit.logEmpty')}</p>
      ) : (
        <>
          <p className="tabular text-body-2 text-fg-sub">
            {t('visit.summary', { visited, skipped: items.length - visited, cities })}
          </p>
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
            {groups.map((g) => {
              const country = g.trip?.destinations.find((d) => d.countryCode)?.countryCode;
              const total = g.days.reduce((n, d) => n + d.items.length, 0);
              return (
                <li key={g.tripId}>
                  <Link
                    to={`/records/visits?trip=${g.tripId}`}
                    className="flex min-h-12 items-center gap-2 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-body-2">
                      {country ? `${flagEmoji(country)} ` : ''}
                      {g.trip?.title ?? ''}
                    </span>
                    {g.trip && (
                      <span className="tabular shrink-0 text-micro text-fg-muted">
                        {g.trip.startDate.slice(5).replace('-', '.')}
                      </span>
                    )}
                    <span className="tabular shrink-0 text-caption text-fg-sub">
                      {t('visit.tripCount', { visited: g.visited, total })}
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
