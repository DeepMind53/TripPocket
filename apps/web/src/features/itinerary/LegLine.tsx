import { type ItineraryItem } from '@trippocket/shared';
import { Footprints } from 'lucide-react';
import { isFlightLeg, FAR_LEG_KM } from '../../domain/dayTools';
import { useTranslation } from '../../i18n';
import { distanceKm, formatDistance, walkMinutes } from '@trippocket/shared';

export function LegLine({ from, to }: { from: ItineraryItem; to: ItineraryItem | undefined }) {
  const { t } = useTranslation();
  const a = from.place?.coords;
  const b = to?.place?.coords;
  if (!a || !b || isFlightLeg(from)) return null;
  const km = distanceKm(a, b);
  // 비행기로 건너갈 거리(다른 나라 등)는 걷는 시간을 적지 않는다 (2026-10-27)
  if (km > FAR_LEG_KM) return null;
  // 환승 알약 모양 (docs/29 §4.2) — 문구는 그대로 (사용자 결정 2026-11-10)
  return (
    <li className="relative flex items-center py-0.5 pl-12">
      <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-bg-subtle px-2.5 py-0.5 text-caption text-fg-sub">
        <Footprints aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="tabular truncate">
          {t('labs.leg', { distance: formatDistance(km), min: walkMinutes(km) })}
        </span>
      </span>
    </li>
  );
}
