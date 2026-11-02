import { Navigation } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';

/**
 * 실험실 "공항 → 숙소 길찾기" (2026-11-03): 도착 공항에서 첫 숙소까지 대중교통 길찾기 (Google 지도).
 * 출발지는 공항 이름이라 내 위치를 쓰지 않는다
 */
export function ArrivalRoute({ route }: { route: { from: string; to: string; date: string } }) {
  const { t } = useTranslation();
  const href =
    'https://www.google.com/maps/dir/?api=1&travelmode=transit' +
    `&origin=${encodeURIComponent(route.from)}&destination=${encodeURIComponent(route.to)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-14 items-center gap-3 rounded-card bg-bg-subtle px-3 py-2.5"
    >
      <Navigation aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption font-semibold">
          {t('arrivalRoute.title', { date: formatMonthDay(route.date) })}
        </span>
        <span className="truncate text-caption text-fg-sub">
          {route.from} → {route.to}
        </span>
      </span>
    </a>
  );
}
