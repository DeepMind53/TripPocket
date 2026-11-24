import { type LocalDate } from '@trippocket/shared';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { Button, RollingSlot } from '../../shared/ui';
import { DayWeatherBadge } from '../common/DayWeatherBadge';
import { type TripDayWeather } from '../common/useTripWeather';
import { DayRoll } from './DayRoll';

/**
 * 빈 날 한 줄: "[1일차↔날짜] · 일정 없음  [과거 날씨↔기온]  [+ 추가]" (docs/16 C1).
 * 일정 있는 날 머리와 같은 전광판·같은 크기 — 좁은 화면에서 날짜·"일정 없음"이 두 줄로 잘리지 않게 (사용자 요청 2026-11-23)
 */
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
  const title = t('plan.dayHeader', { n: index + 1, date: formatMonthDay(date) });
  return (
    <section
      aria-label={title}
      data-day={date}
      className="flex min-h-12 items-center gap-1 rounded-card border border-dashed border-line pr-1 pl-3"
    >
      <h2 aria-label={title} className="tabular flex min-w-0 flex-1 items-center gap-1.5">
        <DayRoll date={date} index={index} />
        <span className="truncate text-caption whitespace-nowrap text-fg-muted">
          · {t('plan.noItems')}
        </span>
      </h2>
      {/* 날씨·오늘을 한 칸에서 번갈아 — 일정 있는 날 머리와 같은 방식 (작년 기록이면 "과거 날씨"·기온도 펼쳐 넣음, docs/31 §11 R2) */}
      <RollingSlot
        reserve
        items={[
          weather?.year && <DayWeatherBadge key="wp" weather={weather} part="past" />,
          weather && <DayWeatherBadge key="w" weather={weather} part="info" />,
          isToday && (
            <span
              key="today"
              className="rounded-full bg-primary-weak px-2 py-0.5 text-micro whitespace-nowrap text-primary"
            >
              {t('date.today')}
            </span>
          ),
        ].filter(Boolean)}
      />
      {canEdit && (
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 px-2"
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
