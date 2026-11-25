import { getTripDays } from '@trippocket/shared';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { useTrip, useTripBookings, useTripItems } from '../../data/hooks';
import { sunTimes } from '../../domain/sun';
import { useTranslation } from '../../i18n';
import { useTimeText } from '../../shared/hooks/useTimeText';
import { formatMonthDay, formatPeriod } from '../../shared/lib/dateFormat';
import { Button, SegmentedControl, TopBar } from '../../shared/ui';
import { useTripWeather } from '../common/useTripWeather';
import { PrintDay } from './PrintDay';
import { useTripHolidays } from './useTripHolidays';

type Mode = 'simple' | 'detail';

/**
 * 인쇄용 일정표 (2026-10-26, 2026-11-25 간단·상세): 브라우저 인쇄로 PDF 저장 — 머리·버튼은 인쇄에서 빠진다.
 * 간단 = 날짜별 일정·숙소·예약번호 + 날씨·공휴일. 상세 = 일차 지도·해 뜨고 지는 시각·그날 예약·시간·주소·메모·체크인/아웃
 */
export function PrintPage() {
  const { t } = useTranslation();
  const { time } = useTimeText();
  const { tripId } = useParams();
  const trip = useTrip(tripId ?? undefined);
  const items = useTripItems(tripId) ?? [];
  const bookings = (useTripBookings(tripId) ?? []).filter((b) => !b.deletedAt);
  const [mode, setMode] = useState<Mode>('simple');
  const weather = useTripWeather(trip ?? undefined);
  const holidays = useTripHolidays(trip ?? PLACEHOLDER, !!trip);
  if (!trip) return null;
  const days = getTripDays(trip.startDate, trip.endDate);
  const coords = trip.destinations.find((d) => d.coords)?.coords;
  const detail = mode === 'detail';
  // 메모·Plan B 대안 일정은 일정 화면 기본 목록과 같게 (대안 플랜은 빼고)
  const dayItems = (d: string | null) => items.filter((i) => i.date === d && !i.planId);
  const wish = dayItems(null);

  return (
    <div className="mx-auto min-h-dvh max-w-[720px] pb-10">
      <div className="no-print">
        <TopBar title={t('print.title')} backTo={`/trips/${trip.id}/plan`} />
      </div>
      <article className="flex flex-col gap-4 px-5 pt-2">
        <header className="flex flex-col">
          <h1 className="text-title-2">{`${trip.cover.emoji ?? ''} ${trip.title}`.trim()}</h1>
          <p className="tabular text-body-2 text-fg-sub">
            {formatPeriod(trip.startDate, trip.endDate)}
          </p>
        </header>
        <div className="no-print flex flex-col gap-2">
          <SegmentedControl
            label={t('print.mode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'simple', label: t('print.modeSimple') },
              { value: 'detail', label: t('print.modeDetail') },
            ]}
          />
          <p className="text-caption whitespace-pre-line text-fg-muted">
            {t(detail ? 'print.modeDetailDesc' : 'print.modeSimpleDesc')}
          </p>
          <Button
            fullWidth
            leading={<Printer aria-hidden="true" className="size-[18px]" />}
            onClick={() => window.print()}
          >
            {t('print.action')}
          </Button>
        </div>
        {days.map((d, n) => (
          <PrintDay
            key={d}
            date={d}
            title={t('plan.dayHeader', { n: n + 1, date: formatMonthDay(d) })}
            dayIndex={n}
            items={dayItems(d)}
            bookings={bookings}
            weather={weather[d]}
            holiday={holidays[d]}
            sun={coords ? sunTimes(d, coords, trip.timezone) : null}
            detail={detail}
            time={time}
          />
        ))}
        {wish.length > 0 && (
          <PrintDay
            date={null}
            title={t('plan.wishlist')}
            dayIndex={0}
            items={wish}
            bookings={bookings}
            detail={detail}
            time={time}
          />
        )}
      </article>
    </div>
  );
}

/** 여행을 불러오기 전 훅 자리 채우기 (훅은 늘 같은 순서로 불러야 한다) */
const PLACEHOLDER = {
  id: '',
  title: '',
  destinations: [],
  startDate: '2000-01-01',
  endDate: '2000-01-01',
  timezone: 'UTC',
  cover: {},
  createdAt: '',
  updatedAt: '',
} as unknown as Parameters<typeof useTripHolidays>[0];
