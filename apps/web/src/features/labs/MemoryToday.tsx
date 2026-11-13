import { ChevronRight, History } from 'lucide-react';
import { Link } from 'react-router';
import { useTrips } from '../../data/hooks';
import { useLab } from '../../data/labsStore';
import { memoryOfToday } from '../../domain/tripHints';
import { useTranslation } from '../../i18n';

/**
 * 몇 년 전 오늘 (실험실 memoryToday, 2026-11-13): 지난해들의 오늘 여행 중이었으면 홈에 한 줄 —
 * 누르면 그날 일정. 여행 중일 때는 보이지 않는다 (HomePage)
 */
export function MemoryToday({ today }: { today: string }) {
  const { t } = useTranslation();
  const on = useLab('memoryToday');
  const trips = useTrips();
  if (!on || !trips) return null;
  const m = memoryOfToday(trips, today);
  if (!m) return null;
  return (
    <Link
      to={`/trips/${m.trip.id}/plan?day=${m.dayN}`}
      className="flex min-h-12 items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 active:bg-bg-subtle"
    >
      <History aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption text-fg-muted">{t('hint.memoryYears', { n: m.years })}</span>
        <span className="truncate text-body-2 font-medium">
          {t('hint.memoryDay', { title: m.trip.title, n: m.dayN })}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
    </Link>
  );
}
