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
  const cards: { emoji: string; value: string; label: string; fun?: string | undefined }[] = [
    {
      emoji: '🚶',
      value: t('travelReview.km', { n: km(s.walkKm) }),
      label: t('travelReview.walk'),
      fun: s.walkKm > 0 ? ratio(s.walkKm / MARATHON_KM, 'walkFun') : t('travelReview.walkEmpty'),
    },
    {
      emoji: '🚇',
      value: t('travelReview.km', { n: km(s.transitKm) }),
      label: t('travelReview.transit'),
      fun: ratio(s.transitKm / SEOUL_BUSAN_KM, 'transitFun'),
    },
    {
      emoji: '✈️',
      value: t('travelReview.times', { n: s.flights }),
      label: t('travelReview.flights'),
    },
    {
      emoji: '📍',
      value: t('travelReview.count', { n: s.places }),
      label: t('travelReview.places'),
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
            emoji: flagEmoji(s.topCountry.code),
            value: countryName(s.topCountry.code),
            label: t('travelReview.topCountry'),
            fun: t('travelReview.topCountryFun', { n: s.topCountry.trips }),
          },
        ]
      : []),
    ...(s.longest
      ? [
          {
            emoji: '🗓',
            value: t('travelReview.days', { n: s.longest.days }),
            label: t('travelReview.longest'),
            fun: s.longest.title,
          },
        ]
      : []),
    {
      emoji: '🛏',
      value: t('travelReview.nightsN', { n: s.nights }),
      label: t('travelReview.nights'),
    },
    {
      emoji: '🌍',
      value: t('travelReview.tripsSplit', { overseas: s.overseas, domestic: s.domestic }),
      label: t('travelReview.split'),
      fun: t('travelReview.thisYear', { n: s.thisYear }),
    },
    ...(s.earliest
      ? [
          {
            emoji: '🌅',
            value: s.earliest,
            label: t('travelReview.earliest'),
            fun: t('travelReview.latestFun', { time: s.latest ?? s.earliest }),
          },
        ]
      : []),
    ...(s.busiestDay
      ? [
          {
            emoji: '🏃',
            value: t('travelReview.count', { n: s.busiestDay.count }),
            label: t('travelReview.busiest'),
            fun: s.busiestDay.date.slice(2).replace(/-/g, '.'),
          },
        ]
      : []),
    {
      emoji: '☕',
      value: t('travelReview.cafeFood', { cafe: s.cafes, food: s.restaurants }),
      label: t('travelReview.cafeFoodLabel'),
    },
    {
      emoji: '🔁',
      value: t('travelReview.count', { n: s.revisits }),
      label: t('travelReview.revisits'),
    },
    ...(s.farthest
      ? [
          {
            emoji: '🌏',
            value: t('travelReview.km', { n: km(s.farthest.km) }),
            label: t('travelReview.farthest'),
            fun: s.farthest.title,
          },
        ]
      : []),
  ];

  return (
    <section aria-label={t('travelReview.title')} className="flex flex-col gap-2">
      <h2 className="text-caption font-bold text-fg-muted">{t('travelReview.title')}</h2>
      <ul className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <li
            key={c.label}
            className="flex flex-col gap-0.5 rounded-card border border-line bg-surface p-3"
          >
            <span aria-hidden="true" className="text-[22px] leading-none">
              {c.emoji}
            </span>
            <span className="tabular truncate text-title-2">{c.value}</span>
            <span className="text-caption font-semibold text-fg-sub">{c.label}</span>
            {c.fun && <span className="truncate text-micro text-fg-muted">{c.fun}</span>}
          </li>
        ))}
      </ul>
      <p className="text-micro text-fg-muted">{t('travelReview.note')}</p>
    </section>
  );
}
