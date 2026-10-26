import { flagEmoji, type Trip } from '@trippocket/shared';
import { useVisitedItems } from '../../data/hooks';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { KIND_ICON } from '../itinerary/itemKinds';

/** 한 번에 보여 줄 최근 기록 수 */
const RECENT = 20;

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
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
          {items.slice(0, RECENT).map((i) => {
            const Icon = KIND_ICON[i.kind];
            const trip = tripById.get(i.tripId);
            const country = trip?.destinations.find((d) => d.countryCode)?.countryCode;
            return (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-sub" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-2 font-medium">{i.title}</span>
                  <span className="tabular truncate text-caption text-fg-muted">
                    {country ? `${flagEmoji(country)} ` : ''}
                    {trip?.title ?? ''} · {i.date?.slice(2).replace(/-/g, '.')}
                  </span>
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
      )}
    </section>
  );
}
