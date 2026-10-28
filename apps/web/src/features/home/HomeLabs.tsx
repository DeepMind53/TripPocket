import {
  COUNTRY_CURRENCY,
  HUNDRED_UNIT,
  todayIn,
  toKrw,
  type ItineraryItem,
  type Trip,
} from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { useLab } from '../../data/labsStore';
import { cachedFx } from '../../data/services/fxService';
import { useSettings } from '../../data/settingsStore';
import { hoursAhead, tripProgress } from '../../domain/travelExtras';
import { tripCountries } from '../../domain/tripPlace';
import { useTranslation } from '../../i18n';

/**
 * 홈 여행 카드 아래 도움 줄:
 * - 출발 전 시차 (설정 "일정" — 2026-10-28 실험실에서 정식, Google 여행 참고)
 * - 실험실 "여행 진행률": 여행 중 며칠째·다녀온 일정 (Polarsteps)
 * - 실험실 "오늘 환율 한 줄": 저장해 둔 환율로만 (새로 받지 않음, 트리플)
 */
export function HomeLabs({
  trip,
  items,
  ongoing,
}: {
  trip: Trip;
  items: readonly ItineraryItem[];
  ongoing: boolean;
}) {
  const { t } = useTranslation();
  const jetLagOn = useSettings((s) => s.jetLag);
  const progressOn = useLab('tripProgress');
  const fxOn = useLab('fxLine');
  const currency = tripCountries(trip)
    .map((c) => COUNTRY_CURRENCY[c])
    .find((c) => c && c !== 'KRW');
  const [fx, setFx] = useState<{ rate: number; date: string } | null>(null);
  useEffect(() => {
    if (!fxOn || !currency) return;
    let alive = true;
    void cachedFx().then((c) => {
      const rate = c?.rates[currency];
      if (alive && c && rate) setFx({ rate, date: c.date });
    });
    return () => {
      alive = false;
    };
  }, [fxOn, currency]);

  const lines: string[] = [];
  const ahead = jetLagOn && !ongoing ? hoursAhead(trip.timezone) : null;
  if (ahead !== null)
    lines.push(
      ahead === 0
        ? t('labs.jetLagSame')
        : t(ahead > 0 ? 'labs.jetLagAhead' : 'labs.jetLagBehind', { h: Math.abs(ahead) }),
    );
  const progress = progressOn && ongoing ? tripProgress(trip, items, todayIn(trip.timezone)) : null;
  if (fxOn && fx && currency) {
    const unit = HUNDRED_UNIT.has(currency) ? 100 : 1;
    lines.push(
      t('labs.fxLine', {
        unit,
        code: currency,
        won: new Intl.NumberFormat('ko', { maximumFractionDigits: unit === 1 ? 1 : 0 }).format(
          toKrw(unit, fx.rate, 0),
        ),
        date: fx.date.slice(5).replace('-', '.'),
      }),
    );
  }
  if (!lines.length && !progress) return null;
  return (
    <ul aria-label={t('labs.homeLabel')} className="flex flex-col gap-1">
      {progress && (
        <li className="flex flex-col gap-1 rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
          {t('labs.tripProgress', {
            day: progress.day,
            days: progress.days,
            done: progress.done,
            total: progress.total,
          })}
          <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-line">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(progress.day / progress.days) * 100}%` }}
            />
          </span>
        </li>
      )}
      {lines.map((l) => (
        <li key={l} className="rounded-btn bg-bg-subtle px-3 py-2 text-caption text-fg-sub">
          {l}
        </li>
      ))}
    </ul>
  );
}
