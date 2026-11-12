import {
  BedDouble,
  CalendarDays,
  Coffee,
  Footprints,
  Globe,
  MapPin,
  Plane,
  Repeat,
  Route,
  Sunrise,
  TrainFront,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { flagEmoji, todayIn, type Trip } from '@trippocket/shared';
import { useTripsData } from '../../data/hooks';
import { travelStats } from '../../domain/tripStats';
import { useTranslation } from '../../i18n';

/** 재미있는 비교 기준 (km) */
const MARATHON_KM = 42.195;
const SEOUL_BUSAN_KM = 325;

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * 실험실 "여행 회고" (사용자 요청 2026-10-26): 다녀온 여행을 쌓아 센 기록을 카드로.
 * 거리는 일정 좌표 사이 직선거리 어림 (domain/tripStats.ts)
 */
export function TravelReview({ pastTrips }: { pastTrips: readonly Trip[] }) {
  const { t } = useTranslation();
  const data = useTripsData(pastTrips.map((tr) => tr.id));
  if (!data || pastTrips.length === 0) return null;
  const s = travelStats(pastTrips, data.items, data.bookings, todayIn('Asia/Seoul'));
  const km = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  // 한 번이 안 되면 "마라톤의 3%"처럼 (0번은 어색하다)
  const ratio = (r: number, key: 'walkFun' | 'transitFun') =>
    r >= 1
      ? t(`travelReview.${key}`, { n: km(r) })
      : t(`travelReview.${key}Pct`, { n: Math.max(1, Math.round(r * 100)) });
  const cards: {
    icon?: LucideIcon;
    flag?: string;
    value: string;
    label: string;
    fun?: string | undefined;
    /** 값이 0이면 숨긴다 (0km·0번 카드가 어색하다는 사용자 피드백 2026-11-13) */
    zero?: boolean;
  }[] = [
    {
      icon: Footprints,
      value: t('travelReview.km', { n: km(s.walkKm) }),
      label: t('travelReview.walk'),
      fun: ratio(s.walkKm / MARATHON_KM, 'walkFun'),
      zero: s.walkKm <= 0,
    },
    {
      icon: TrainFront,
      value: t('travelReview.km', { n: km(s.transitKm) }),
      label: t('travelReview.transit'),
      fun: ratio(s.transitKm / SEOUL_BUSAN_KM, 'transitFun'),
      zero: s.transitKm <= 0,
    },
    {
      icon: Plane,
      value: t('travelReview.times', { n: s.flights }),
      label: t('travelReview.flights'),
      zero: s.flights === 0,
    },
    {
      icon: MapPin,
      value: t('travelReview.count', { n: s.places }),
      label: t('travelReview.places'),
      zero: s.places === 0,
      ...(s.topKind
        ? {
            fun: t('travelReview.topKind', {
              kind: t(`kind.${s.topKind.kind}`),
              n: s.topKind.count,
            }),
          }
        : {}),
    },
    ...(s.topCountry
      ? [
          {
            flag: flagEmoji(s.topCountry.code),
            value: countryName(s.topCountry.code),
            label: t('travelReview.topCountry'),
            fun: t('travelReview.topCountryFun', { n: s.topCountry.trips }),
          },
        ]
      : []),
    ...(s.longest
      ? [
          {
            icon: CalendarDays,
            value: t('travelReview.days', { n: s.longest.days }),
            label: t('travelReview.longest'),
            fun: s.longest.title,
          },
        ]
      : []),
    {
      icon: BedDouble,
      value: t('travelReview.nightsN', { n: s.nights }),
      label: t('travelReview.nights'),
      zero: s.nights === 0,
    },
    {
      icon: Globe,
      value: t('travelReview.tripsSplit', { overseas: s.overseas, domestic: s.domestic }),
      label: t('travelReview.split'),
      fun: t('travelReview.thisYear', { n: s.thisYear }),
      zero: s.overseas + s.domestic === 0,
    },
    ...(s.earliest
      ? [
          {
            icon: Sunrise,
            value: s.earliest,
            label: t('travelReview.earliest'),
            fun: t('travelReview.latestFun', { time: s.latest ?? s.earliest }),
          },
        ]
      : []),
    ...(s.busiestDay
      ? [
          {
            icon: Zap,
            value: t('travelReview.count', { n: s.busiestDay.count }),
            label: t('travelReview.busiest'),
            fun: s.busiestDay.date.slice(2).replace(/-/g, '.'),
          },
        ]
      : []),
    {
      icon: Coffee,
      value: t('travelReview.cafeFood', { cafe: s.cafes, food: s.restaurants }),
      label: t('travelReview.cafeFoodLabel'),
      zero: s.cafes + s.restaurants === 0,
    },
    {
      icon: Repeat,
      value: t('travelReview.count', { n: s.revisits }),
      label: t('travelReview.revisits'),
      zero: s.revisits === 0,
    },
    ...(s.farthest
      ? [
          {
            icon: Route,
            value: t('travelReview.km', { n: km(s.farthest.km) }),
            label: t('travelReview.farthest'),
            fun: s.farthest.title,
          },
        ]
      : []),
  ];
  const shown = cards.filter((c) => !c.zero);
  if (shown.length === 0) return null;

  return (
    <section aria-label={t('travelReview.title')} className="flex flex-col gap-2">
      <h2 className="text-caption font-semibold text-fg-muted">{t('travelReview.title')}</h2>
      <ul className="grid grid-cols-2 gap-2">
        {shown.map((c) => (
          <li
            key={c.label}
            className="flex flex-col gap-0.5 rounded-card border border-line bg-surface p-3"
          >
            {c.icon ? (
              <c.icon aria-hidden="true" className="mb-1 size-5 text-fg-muted" strokeWidth={1.75} />
            ) : (
              <span aria-hidden="true" className="mb-1 text-[20px] leading-none">
                {c.flag}
              </span>
            )}
            <span className="tabular text-title-2 text-pretty">{c.value}</span>
            <span className="text-caption font-medium text-fg-sub">{c.label}</span>
            {c.fun && <span className="line-clamp-2 text-micro text-fg-muted">{c.fun}</span>}
          </li>
        ))}
      </ul>
      <p className="text-micro text-fg-muted">{t('travelReview.note')}</p>
    </section>
  );
}
