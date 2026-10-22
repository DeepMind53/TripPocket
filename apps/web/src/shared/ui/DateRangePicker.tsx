import { diffDays, weekday, type LocalDate } from '@trippocket/shared';
import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import type { WeatherKind } from '../../domain/weather';
import { cn } from '../lib/cn';
import { WeatherIcon } from './WeatherIcon';
import { formatMonthDay } from '../lib/dateFormat';
import { buildMonths, isInRange, pickRange, type DateRange } from '../lib/dateRange';

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  today: LocalDate;
  /** 오늘 이후로 보여줄 개월 수 */
  months?: number;
  /** 이 날짜가 속한 달부터 보여준다 (기본: 오늘). 지난 여행 수정용 */
  from?: LocalDate | undefined;
  /** 날짜 칸에 덧붙일 정보 (공휴일·날씨). 주면 칸이 높아진다 */
  annotate?: ((date: LocalDate) => DayNote | undefined) | undefined;
  /** 각 달 달력 아래에 붙일 내용 (예: 그달 공휴일 목록). 인자: "YYYY-MM" */
  monthFooter?: ((monthKey: string) => ReactNode) | undefined;
}

/** 날짜 칸 덧붙임 정보 */
export interface DayNote {
  /** 칸 아래 짧은 공휴일 이름 */
  holiday?: string | undefined;
  /** 화면 읽기용 전체 설명 (공휴일 전체 이름·날씨) */
  description?: string | undefined;
  weather?: WeatherKind | undefined;
  temps?: string | undefined;
  /** 이미 있는 다른 여행 기간이면 칸 아래 막대. tripTitle은 여행 첫날(또는 매달 1일)에만 */
  trip?: boolean | undefined;
  tripTitle?: string | undefined;
}

/** S-32 날짜 범위 선택: 세로 스크롤 달력 (외부 라이브러리 없이) */
export function DateRangePicker({
  value,
  onChange,
  today,
  months = 13,
  from,
  annotate,
  monthFooter,
}: DateRangePickerProps) {
  const { t } = useTranslation();
  const start = from && diffDays(from, today) > 0 ? from : today;
  // 시작 달이 앞당겨진 만큼 개월 수를 늘린다 (대략 30일 = 1개월)
  const extra = Math.ceil(diffDays(start, today) / 30);
  const grids = useMemo(() => buildMonths(start, months + extra), [start, months, extra]);
  const weekdays = t('date.weekdayChars');
  // 클릭 함수를 고정해 바뀐 칸만 다시 그리게 한다 (최신 값은 ref로)
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const pick = useCallback((d: LocalDate) => onChange(pickRange(valueRef.current, d)), [onChange]);

  return (
    <div role="group" aria-label={t('date.rangeLabel')} className="flex flex-col gap-6">
      {grids.map((g) => (
        <section
          key={g.key}
          aria-label={t('date.monthTitle', { y: g.year, m: g.month })}
          className="border-t border-dashed border-line pt-4 first:border-t-0 first:pt-0"
        >
          <h3 className="mb-2 px-1 text-body-1">
            {t('date.monthTitle', { y: g.year, m: g.month })}
          </h3>
          {/* 요일 줄은 달마다 */}
          <div
            aria-hidden="true"
            className={cn(
              'grid grid-cols-7 text-center text-caption text-fg-muted',
              // 요일 줄과 첫 주 사이를 주와 주 사이 간격과 비슷하게
              annotate ? 'mb-3' : 'mb-1',
            )}
          >
            {[...weekdays].map((w, i) => (
              <span key={w} className={cn(i === 0 && 'text-danger', i === 6 && 'text-primary')}>
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: g.leading }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {g.days.map((date) => {
              const note = annotate?.(date);
              return (
                <DayCell
                  key={date}
                  date={date}
                  today={today}
                  isStart={date === value.start}
                  isEnd={date === value.end}
                  inRange={isInRange(value, date)}
                  onPick={pick}
                  tall={annotate !== undefined}
                  holiday={note?.holiday}
                  description={note?.description}
                  weather={note?.weather}
                  temps={note?.temps}
                  trip={note?.trip}
                  tripTitle={note?.tripTitle}
                />
              );
            })}
          </div>
          {monthFooter?.(g.key)}
        </section>
      ))}
    </div>
  );
}

interface DayCellProps {
  date: LocalDate;
  today: LocalDate;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
  onPick: (date: LocalDate) => void;
  /** 덧붙임 정보를 쓰는 달력이면 칸을 높게 (정보 유무와 상관없이 같은 높이 → 흔들리지 않음) */
  tall: boolean;
  holiday: string | undefined;
  description: string | undefined;
  weather: WeatherKind | undefined;
  temps: string | undefined;
  trip: boolean | undefined;
  tripTitle: string | undefined;
}

// 날짜 칸이 수백 개라 바뀐 칸만 다시 그린다
const DayCell = memo(function DayCell({
  date,
  today,
  isStart,
  isEnd,
  inRange,
  onPick,
  tall,
  holiday,
  description,
  weather,
  temps,
  trip,
  tripTitle,
}: DayCellProps) {
  const { t } = useTranslation();
  const edge = isStart || isEnd;
  const wd = weekday(date);
  const isToday = date === today;
  const label = `${formatMonthDay(date)}${isToday ? ` · ${t('date.today')}` : ''}${description ? ` · ${description}` : ''}`;

  if (tall) {
    return (
      <div
        className={cn(
          'relative flex h-[50px] items-stretch justify-center',
          inRange && !edge && 'bg-primary-weak',
          inRange && isStart && 'rounded-l-2xl bg-primary-weak',
          inRange && isEnd && 'rounded-r-2xl bg-primary-weak',
        )}
      >
        <button
          type="button"
          aria-pressed={edge || inRange}
          aria-label={label}
          onClick={() => onPick(date)}
          className="relative flex w-full min-w-0 flex-col items-center"
        >
          <span
            className={cn(
              'tabular relative grid size-7 shrink-0 place-items-center rounded-full text-body-2',
              edge && 'bg-primary font-bold text-on-primary',
              !edge && (wd === 0 || holiday) && 'text-danger',
              !edge && !holiday && wd === 6 && 'text-primary',
              isToday && !edge && 'font-bold underline underline-offset-4',
            )}
          >
            {Number(date.slice(8))}
            {/* 날씨 그림: 파란 선택 원 바로 바깥 오른쪽, 숫자 높이에 맞춤 (숫자는 날씨 유무와 상관없이 가운데) */}
            {weather && (
              <WeatherIcon
                kind={weather}
                className="absolute top-1/2 left-full ml-px size-3.5 -translate-y-1/2"
              />
            )}
          </span>
          <span aria-hidden="true" className="tabular h-2.5 text-[9px] leading-2.5 text-fg-muted">
            {temps ?? ''}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              'h-2.5 w-full truncate px-0.5 text-center text-[9px] leading-2.5 font-semibold',
              holiday ? 'text-danger' : 'text-fg-sub',
            )}
          >
            {holiday ?? tripTitle ?? ''}
          </span>
        </button>
        {trip && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-fg-muted/50"
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-11 items-center justify-center',
        inRange && !edge && 'bg-primary-weak',
        inRange && isStart && 'rounded-l-full bg-primary-weak',
        inRange && isEnd && 'rounded-r-full bg-primary-weak',
      )}
    >
      <button
        type="button"
        aria-pressed={edge || inRange}
        aria-label={`${formatMonthDay(date)}${isToday ? ` · ${t('date.today')}` : ''}`}
        onClick={() => onPick(date)}
        className={cn(
          'tabular grid size-11 place-items-center rounded-full text-body-2',
          edge && 'bg-primary font-bold text-on-primary',
          !edge && wd === 0 && 'text-danger',
          !edge && wd === 6 && 'text-primary',
          isToday && !edge && 'font-bold underline underline-offset-4',
        )}
      >
        {Number(date.slice(8))}
      </button>
    </div>
  );
});
