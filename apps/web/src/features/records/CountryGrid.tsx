import { flagEmoji } from '@trippocket/shared';
import { useState } from 'react';
import { useTranslation } from '../../i18n';

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
 * 기록 탭 가 본 나라 (사용자 요청 2026-10-27): "국기 나라 이름" 칸을 한 줄에 3개, 3줄까지.
 * 많이 간 나라 먼저, 9개가 넘으면 더보기
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
      <ul aria-label={t('records.countries')} className="grid grid-cols-3 gap-2">
        {shown.map((c) => (
          <li
            key={c}
            className="flex min-h-14 flex-col items-center justify-center rounded-card border border-line bg-surface px-1 py-2 text-center"
          >
            <span className="w-full truncate text-body-2 font-semibold">
              {flagEmoji(c)} {countryName(c)}
            </span>
            <span className="tabular text-micro text-fg-muted">
              {t('records.tripsN', { n: counts.get(c) ?? 0 })}
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
