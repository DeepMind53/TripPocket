import { topAlertLevel, type Trip } from '@trippocket/shared';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { useTripAlerts } from './useTripAlerts';

/** 여행 중 홈: 빨강·주황 여행지 특보가 있으면 한 줄 (누르면 날씨 정보) — docs/24 §2-2 */
export function TripAlertBanner({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const alerts = useTripAlerts(trip, true);
  const level = topAlertLevel(alerts);
  if (!level) return null;
  return (
    <Link
      to={`/trips/${trip.id}/weather`}
      role="alert"
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-card border-l-4 px-3 py-2 text-body-2 font-semibold',
        level === 'red' ? 'border-danger bg-danger/10' : 'border-warning bg-warning/10',
      )}
    >
      <span aria-hidden="true">⚠️</span>
      <span className="min-w-0 flex-1">{t('alerts.banner', { n: alerts.length })}</span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
    </Link>
  );
}
