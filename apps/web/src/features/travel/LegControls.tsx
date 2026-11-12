import { RefreshCw } from 'lucide-react';
import type { LegMode } from '../../domain/travelDay';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

const LABEL = {
  walk: 'travel.modeWalk',
  transit: 'travel.modeTransit',
  drive: 'travel.modeDrive',
} as const;

/**
 * 다음 역 카드 [길찾기] 위 한 줄 (사용자 요청 2026-11-10, 2026-11-13 자동차·홈 추가):
 * [도보|대중교통|자동차] 토글 + [새로고침 n회 남음] (지금 위치에서 다시 재기, 다음 일정마다 1번).
 * 고른 수단으로 출발 시각·남은 시간을 다시 계산한다. 도보·대중교통은 받은 정보가 없으면 고를 수 없고,
 * 자동차는 고를 때 조회한다. 360px에서 한 줄에 들어가게 토글은 글자만
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
  const opt = (m: LegMode, on: boolean) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === m}
      disabled={!on}
      onClick={() => onMode(m)}
      className={cn(
        'flex h-9 min-w-0 flex-1 items-center justify-center rounded-full px-1.5 text-caption font-medium whitespace-nowrap transition-colors disabled:opacity-40',
        mode === m ? 'bg-on-primary text-primary' : 'text-on-primary',
      )}
    >
      {t(LABEL[m])}
    </button>
  );
  return (
    <div className="flex w-full items-stretch gap-2">
      {/* 토글: 한 칸 안에서 셋 중 하나 */}
      <div
        role="radiogroup"
        aria-label={t('travel.legGroup')}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-0.5 rounded-full bg-on-primary/15 p-1"
      >
        {opt('walk', hasWalk)}
        {opt('transit', hasTransit)}
        {opt('drive', true)}
      </div>
      <button
        type="button"
        disabled={hereDisabled}
        onClick={onHere}
        aria-label={left !== null ? t('travel.refreshLeft', { n: left }) : t('travel.fromHere')}
        className="flex min-h-11 shrink-0 flex-col items-center justify-center rounded-full border border-on-primary/40 px-3 text-caption font-medium text-on-primary disabled:opacity-40"
      >
        <span className="flex items-center gap-1 whitespace-nowrap">
          <RefreshCw aria-hidden="true" className="size-3.5 shrink-0" />
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
