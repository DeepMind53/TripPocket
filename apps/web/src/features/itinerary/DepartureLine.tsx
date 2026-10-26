import { distanceKm, walkMinutes, type ItineraryItem, type RouteEta } from '@trippocket/shared';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { routeEta } from '../../data/api/routes';
import { leaveAt } from '../../domain/dayTools';
import { useTranslation } from '../../i18n';

/**
 * 실험실 "출발 시각 알려 주기" (사용자 요청 2026-10-26): 지금 진행 중인 일정 아래,
 * 다음 장소까지 걸어서·대중교통 시간과 몇 시에 나가면 되는지.
 * 길 정보를 못 받으면(오프라인·무료량 끝) 직선거리로 어림한 걷는 시간만
 */
export function DepartureLine({ from, to }: { from: ItineraryItem; to: ItineraryItem }) {
  const { t } = useTranslation();
  const a = from.place?.coords;
  const b = to.place?.coords;
  const google = from.place?.coordsSource === 'google' || to.place?.coordsSource === 'google';
  const [eta, setEta] = useState<RouteEta | null | undefined>(undefined);

  useEffect(() => {
    if (!a || !b) return;
    let alive = true;
    void routeEta(a, b, google).then((r) => alive && setEta(r));
    return () => {
      alive = false;
    };
  }, [a?.lat, a?.lng, b?.lat, b?.lng, google]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!a || !b) return null;
  const rough = { walk: walkMinutes(distanceKm(a, b)) };
  const shown = eta ?? rough;
  const leave = leaveAt(to.startTime, shown);
  const parts = [
    shown.walk !== undefined ? t('departure.walk', { min: shown.walk }) : null,
    eta?.transit !== undefined ? t('departure.transit', { min: eta.transit }) : null,
  ].filter(Boolean);

  return (
    <li
      role="note"
      className="flex flex-col gap-0.5 rounded-btn border border-dashed border-line px-3 py-2 text-caption"
    >
      <span className="truncate text-fg-sub">{t('departure.next', { title: to.title })}</span>
      <span className="tabular flex flex-wrap items-center gap-x-2 font-semibold">
        <Clock aria-hidden="true" className="size-3.5 text-primary" />
        {parts.join(' · ')}
        {leave && <span className="text-primary">{t('departure.leaveAt', { time: leave })}</span>}
      </span>
      {eta === null && <span className="text-micro text-fg-muted">{t('departure.rough')}</span>}
    </li>
  );
}
