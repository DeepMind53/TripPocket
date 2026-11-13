import { KO_PHRASES, PHRASE_IDS, phraseLangFor, type Coords, type Trip } from '@trippocket/shared';
import { Footprints, Sunset } from 'lucide-react';
import { useSettings } from '../../data/settingsStore';
import { sunTimes } from '../../domain/sun';
import { bestWalkWindow, daylightLeft, phraseOfDay } from '../../domain/tripHints';
import type { DayWeather } from '../../domain/weather';
import { useTranslation } from '../../i18n';
import { InlineIcon } from '../../shared/ui/InlineIcon';
import { SpeakButton } from '../phrases/SpeakButton';

/**
 * 여행 중 오늘 (홈·여행 모드 다음 일정 카드 아래, 설정 "일정 · 날씨와 현지 정보" — 2026-11-13 실험실에서 정식):
 * 오늘의 한마디 · 걷기 좋은 시간 · 해 지기까지. 모두 기기 안 정보만
 */
export function TodayTips({
  trip,
  today,
  dayN,
  now,
  weather,
  coords,
}: {
  trip: Trip;
  today: string;
  dayN: number;
  /** 현지 "HH:mm" */
  now: string;
  weather: DayWeather | undefined;
  /** 오늘 장소 좌표 하나 (해 지는 시각) */
  coords: Coords | undefined;
}) {
  const { t } = useTranslation();
  const walkOn = useSettings((st) => st.bestWalkTime);
  const sunOn = useSettings((st) => st.daylightLeft);
  const phraseOn = useSettings((st) => st.phraseOfDay);
  const lines: { icon: typeof Footprints; text: string }[] = [];

  if (walkOn) {
    const win = bestWalkWindow(weather?.hours, Number(now.slice(0, 2)));
    if (win) lines.push({ icon: Footprints, text: t('hint.walk', win) });
  }
  if (sunOn && coords) {
    const sun = sunTimes(today, coords, trip.timezone);
    const left = sun ? daylightLeft(now, sun.set) : null;
    if (left !== null)
      lines.push({
        icon: Sunset,
        text:
          left >= 60
            ? t('hint.daylightHM', { h: Math.floor(left / 60), m: left % 60, at: sun!.set })
            : t('hint.daylightM', { m: left, at: sun!.set }),
      });
  }
  const lang = phraseOn ? phraseLangFor(trip.destinations[0]?.countryCode) : undefined;
  const id = lang ? phraseOfDay(PHRASE_IDS, dayN) : null;

  if (!lines.length && !id) return null;
  return (
    <div className="flex flex-col gap-2">
      {lang && id && (
        <section
          aria-label={t('hint.phraseTitle')}
          className="flex items-center gap-3 rounded-card border border-line bg-surface p-4"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-caption text-fg-muted">
              {t('hint.phraseTitle')} · {KO_PHRASES[id]}
            </span>
            <span lang={lang.code} className="text-body-1 font-semibold">
              {lang.phrases[id]}
            </span>
          </span>
          <SpeakButton text={lang.phrases[id]} lang={lang.code} />
        </section>
      )}
      {lines.map((l) => (
        <p
          key={l.text}
          className="rounded-btn bg-bg-subtle px-3 py-2 text-caption whitespace-pre-line text-fg-sub"
        >
          <InlineIcon icon={l.icon} />
          {l.text}
        </p>
      ))}
    </div>
  );
}
