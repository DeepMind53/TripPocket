import { Footprints, LocateFixed, TrainFront } from 'lucide-react';
import type { LegMode } from '../../domain/travelDay';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

/**
 * 다음 역 카드 오른쪽 (사용자 요청 2026-11-10): [도보][대중교통] 고르기 + 아래 [현재 위치] (다음 일정마다 1번).
 * 고른 수단으로 출발 시각·남은 시간을 다시 계산한다. 없는 수단은 누를 수 없다
 */
export function LegControls({
  mode,
  onMode,
  hasWalk,
  hasTransit,
  onHere,
  hereDisabled,
  left,
}: {
  mode: LegMode | null;
  onMode: (mode: LegMode) => void;
  hasWalk: boolean;
  hasTransit: boolean;
  onHere: () => void;
  hereDisabled: boolean;
  /** 오늘 남은 길 조회 수 (모르면 null) */
  left: number | null;
}) {
  const { t } = useTranslation();
  const opt = (m: LegMode, Icon: typeof Footprints, on: boolean) => (
    <button
      type="button"
      aria-pressed={mode === m}
      disabled={!on}
      onClick={() => onMode(m)}
      className={cn(
        'flex h-11 items-center justify-center gap-1 rounded-btn px-2 text-caption font-medium whitespace-nowrap disabled:opacity-40',
        mode === m ? 'bg-on-primary text-primary' : 'bg-on-primary/15 text-on-primary',
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {t(m === 'walk' ? 'travel.modeWalk' : 'travel.modeTransit')}
    </button>
  );
  return (
    <div
      role="group"
      aria-label={t('travel.legGroup')}
      className="flex w-24 shrink-0 flex-col gap-1.5"
    >
      {opt('walk', Footprints, hasWalk)}
      {opt('transit', TrainFront, hasTransit)}
      <button
        type="button"
        disabled={hereDisabled}
        onClick={onHere}
        className="flex min-h-11 flex-col items-center justify-center rounded-btn border border-on-primary/40 px-1 py-1 text-caption font-medium text-on-primary disabled:opacity-40"
      >
        <span className="flex items-center gap-1 whitespace-nowrap">
          <LocateFixed aria-hidden="true" className="size-4 shrink-0" />
          {t('travel.fromHere')}
        </span>
        {left !== null && (
          <span className="tabular text-micro opacity-85">
            {t('travel.leftToday', { n: left })}
          </span>
        )}
      </button>
    </div>
  );
}
