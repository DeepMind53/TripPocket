import { flagEmoji } from '@trippocket/shared';
import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { Stamp } from '../../shared/ui';

/** 처음 보이는 나라 수 (3줄 × 3) — 넘으면 "+ 더보기" */
const SHOWN = 9;

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * 기록 탭 가 본 나라 (사용자 요청 2026-10-27): 한 줄에 3개, 3줄까지. 많이 간 나라 먼저, 9개가 넘으면 더보기.
 * 여권 도장 모양 (docs/29 §7.21, 사용자 결정 Q6 2026-11-09) — 보여 주는 정보(나라 이름·여행 횟수)는 그대로
 */
export function CountryGrid({
  codes,
  counts,
}: {
  codes: readonly string[];
  counts: ReadonlyMap<string, number>;
}) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const sorted = [...codes].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  const shown = all ? sorted : sorted.slice(0, SHOWN);
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label={t('records.countries')} className="grid grid-cols-3 gap-3 px-1">
        {shown.map((c, i) => (
          <li key={c} className="flex flex-col items-center gap-1">
            <Stamp
              city={countryName(c)}
              period={t('records.tripsN', { n: counts.get(c) ?? 0 })}
              dayIndex={i}
              seed={c}
              label={`${countryName(c)} ${t('records.tripsN', { n: counts.get(c) ?? 0 })}`}
            />
            {/* 국기는 도장 아래 작게 (도장 그림 안에는 이모지를 넣지 않는다) */}
            <span aria-hidden="true" className="text-body-2 leading-none">
              {flagEmoji(c)}
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="mx-auto h-9 rounded-full px-4 text-caption font-semibold text-fg-sub"
        >
          {all ? t('saved.less') : t('records.moreCountries', { n: sorted.length - SHOWN })}
        </button>
      )}
    </div>
  );
}
