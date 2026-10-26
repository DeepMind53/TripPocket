import { flagEmoji, type Trip } from '@trippocket/shared';
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
  const s = travelStats(pastTrips, data.items, data.bookings);
  const km = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  const cards: { emoji: string; value: string; label: string; fun?: string | undefined }[] = [
    {
      emoji: '🚶',
      value: t('travelReview.km', { n: km(s.walkKm) }),
      label: t('travelReview.walk'),
      fun:
        s.walkKm > 0
          ? t('travelReview.walkFun', { n: km(s.walkKm / MARATHON_KM) })
          : t('travelReview.walkEmpty'),
    },
    {
      emoji: '🚇',
      value: t('travelReview.km', { n: km(s.transitKm) }),
      label: t('travelReview.transit'),
      fun: t('travelReview.transitFun', { n: km(s.transitKm / SEOUL_BUSAN_KM) }),
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
