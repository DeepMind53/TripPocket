import { Footprints, LocateFixed, TrainFront } from 'lucide-react';
import type { LegMode } from '../../domain/travelDay';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

/**
 * 다음 역 카드 [길찾기] 위 한 줄 (사용자 요청 2026-11-10): [도보|대중교통] 토글 + [현재 위치] (다음 일정마다 1번).
 * 고른 수단으로 출발 시각·남은 시간을 다시 계산한다. 받은 정보가 없는 수단은 고를 수 없다
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
      role="radio"
      aria-checked={mode === m}
      disabled={!on}
      onClick={() => onMode(m)}
      className={cn(
        'flex h-9 flex-1 items-center justify-center gap-1 rounded-full px-2 text-caption font-medium whitespace-nowrap transition-colors disabled:opacity-40',
        mode === m ? 'bg-on-primary text-primary' : 'text-on-primary',
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {t(m === 'walk' ? 'travel.modeWalk' : 'travel.modeTransit')}
    </button>
  );
  return (
    <div className="flex w-full items-stretch gap-2">
      {/* 토글: 한 칸 안에서 둘 중 하나 */}
      <div
        role="radiogroup"
        aria-label={t('travel.legGroup')}
        className="flex min-h-11 flex-1 items-center gap-1 rounded-full bg-on-primary/15 p-1"
      >
        {opt('walk', Footprints, hasWalk)}
        {opt('transit', TrainFront, hasTransit)}
      </div>
      <button
        type="button"
        disabled={hereDisabled}
        onClick={onHere}
        className="flex min-h-11 shrink-0 flex-col items-center justify-center rounded-full border border-on-primary/40 px-3 text-caption font-medium text-on-primary disabled:opacity-40"
      >
        <span className="flex items-center gap-1 whitespace-nowrap">
          <LocateFixed aria-hidden="true" className="size-4 shrink-0" />
          {t('travel.fromHere')}
        </span>
        {left !== null && (
          <span className="tabular text-micro leading-none opacity-85">
            {t('travel.leftToday', { n: left })}
          </span>
        )}
      </button>
    </div>
  );
}
