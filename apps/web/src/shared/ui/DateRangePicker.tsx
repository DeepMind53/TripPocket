import { diffDays, weekday, type LocalDate } from '@trippocket/shared';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../lib/cn';
import { formatMonthDay } from '../lib/dateFormat';
import { buildMonths, isInRange, pickRange, type DateRange } from '../lib/dateRange';

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  today: LocalDate;
  /** 오늘 이후로 보여줄 개월 수 */
  months?: number;
  /** 이 날짜가 속한 달부터 보여준다 (기본: 오늘). 지난 여행 수정용 */
  from?: LocalDate;
  /** 바텀시트 안에서 쓰면 요일 줄을 시트 맨 위에 고정 */
  inSheet?: boolean;
}

/** S-32 날짜 범위 선택: 세로 스크롤 달력 (외부 라이브러리 없이) */
export function DateRangePicker({
  value,
  onChange,
  today,
  months = 13,
  from,
  inSheet = false,
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
      <div
        aria-hidden="true"
        className={cn(
          'sticky z-10 grid grid-cols-7 py-1 text-center text-caption text-fg-muted',
          inSheet ? 'top-0 bg-surface' : 'top-[calc(env(safe-area-inset-top)+56px)] bg-bg',
        )}
      >
        {[...weekdays].map((w, i) => (
          <span key={w} className={cn(i === 0 && 'text-danger', i === 6 && 'text-primary')}>
            {w}
          </span>
        ))}
      </div>
      {grids.map((g) => (
        <section key={g.key} aria-label={t('date.monthTitle', { y: g.year, m: g.month })}>
          <h3 className="mb-2 px-1 text-body-1">
            {t('date.monthTitle', { y: g.year, m: g.month })}
          </h3>
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: g.leading }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {g.days.map((date) => (
              <DayCell
                key={date}
                date={date}
                today={today}
                isStart={date === value.start}
                isEnd={date === value.end}
                inRange={isInRange(value, date)}
                onPick={pick}
              />
            ))}
          </div>
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
}

// 날짜 칸이 수백 개라 바뀐 칸만 다시 그린다
const DayCell = memo(function DayCell({
  date,
  today,
  isStart,
  isEnd,
  inRange,
  onPick,
}: DayCellProps) {
  const { t } = useTranslation();
  const edge = isStart || isEnd;
  const wd = weekday(date);
  const isToday = date === today;
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
