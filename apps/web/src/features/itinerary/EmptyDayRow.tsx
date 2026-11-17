import { type LocalDate } from '@trippocket/shared';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { Button, routeColor } from '../../shared/ui';
import { DayWeatherBadge } from '../common/DayWeatherBadge';
import { type TripDayWeather } from '../common/useTripWeather';

/** 빈 날 한 줄: "3일차 10.29 (목) · 일정 없음  [+ 추가]" (docs/16 C1) */
export function EmptyDayRow({
  date,
  index,
  isToday,
  canEdit,
  onAdd,
  weather,
}: {
  date: LocalDate;
  index: number;
  isToday: boolean;
  canEdit: boolean;
  onAdd: () => void;
  weather?: TripDayWeather | undefined;
}) {
  const { t } = useTranslation();
  const dayInk = routeColor(index).ink;
  const title = t('plan.dayHeader', { n: index + 1, date: formatMonthDay(date) });
  return (
    <section
      aria-label={title}
      data-day={date}
      className="flex min-h-12 items-center gap-2 rounded-2xl border border-dashed border-line pr-1 pl-4"
    >
      <h2 aria-label={title} className="tabular flex flex-1 items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap text-on-primary"
          style={{ background: dayInk }}
        >
          {t('plan.dayN', { n: index + 1 })}
        </span>
        <span className="text-body-2 font-semibold">{formatMonthDay(date)}</span>
        {isToday && (
          <span className="rounded-full bg-primary-weak px-2 py-0.5 text-micro text-primary">
            {t('date.today')}
          </span>
        )}
        <span className="text-caption text-fg-muted">· {t('plan.noItems')}</span>
      </h2>
      <DayWeatherBadge weather={weather} />
      {canEdit && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onAdd}
          aria-label={t('plan.addItemTo', { day: title })}
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('plan.addShort')}
        </Button>
      )}
    </section>
  );
}
