import type { Trip } from '@trippocket/shared';
import { Plus } from 'lucide-react';
import { packingTips, type PackingTip } from '../../domain/packingWeather';
import { useTranslation } from '../../i18n';
import { useTripWeather } from '../common/useTripWeather';

/**
 * 날씨 맞춤 준비물 (2026-10-27, 같은 날 실험실에서 정식): 여행 날씨(2주 안 예보, 그 밖은 작년 기록)로 챙길 것을 제안.
 * [추가]는 준비물 초안에 넣기만 — 하단 [저장]을 눌러야 저장된다 (준비 화면 규칙)
 */
export function WeatherPackingTips({
  trip,
  have,
  onAdd,
}: {
  trip: Trip;
  /** 지금 준비물 이름들 (이미 있는 것은 제안하지 않음) */
  have: readonly string[];
  onAdd: (tip: PackingTip) => void;
}) {
  const { t } = useTranslation();
  const weather = useTripWeather(trip);
  const tips = packingTips(Object.values(weather), have);
  if (!tips.length) return null;
  return (
    <section
      aria-label={t('labs.packTitle')}
      className="flex flex-col gap-2 rounded-card bg-bg-subtle px-3 py-2.5"
    >
      <h2 className="text-caption font-bold text-fg-sub">🌦 {t('labs.packTitle')}</h2>
      <ul className="flex flex-wrap gap-1.5">
        {tips.map((tip) => (
          <li key={tip.text}>
            <button
              type="button"
              onClick={() => onAdd(tip)}
              aria-label={t('labs.packAdd', { text: tip.text })}
              className="flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 text-caption"
            >
              <Plus aria-hidden="true" className="size-3.5 text-primary" />
              {tip.text}
              <span className="text-micro text-fg-muted">
                · {t(`labs.packReason.${tip.reason}`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
