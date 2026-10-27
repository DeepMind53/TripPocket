import { COUNTRY_CURRENCY, type FxSnapshot } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { useLab } from '../../data/labsStore';
import { cachedFx } from '../../data/services/fxService';
import { memoAmounts } from '../../domain/memoFx';
import { useTranslation } from '../../i18n';

/**
 * 실험실 "메모 속 외화 → 원화" (2026-10-27): 일정 상세 메모 아래에 "¥1,200 ≈ 11,040원".
 * 저장해 둔 환율(기기)만 쓰고 새로 부르지 않는다. 금액은 저장하지 않는다 (계산만)
 */
export function MemoFx({ memo, countryCode }: { memo: string; countryCode?: string | undefined }) {
  const { t } = useTranslation();
  const on = useLab('memoFx');
  const [fx, setFx] = useState<FxSnapshot | null>(null);
  useEffect(() => {
    if (on) void cachedFx().then(setFx);
  }, [on]);
  if (!on || !fx) return null;
  const amounts = memoAmounts(memo, countryCode ? COUNTRY_CURRENCY[countryCode] : undefined)
    .map((a) => ({ ...a, rate: fx.rates[a.code] }))
    .filter((a): a is typeof a & { rate: number } => typeof a.rate === 'number');
  if (!amounts.length) return null;
  return (
    <ul aria-label={t('labs.memoFxLabel')} className="mt-1 flex flex-col gap-0.5">
      {amounts.map((a) => (
        <li key={a.text} className="tabular text-caption text-fg-sub">
          💱 {a.text} ≈{' '}
          {t('labs.memoFxWon', {
            won: Math.round(a.amount * a.rate).toLocaleString('ko-KR'),
          })}
        </li>
      ))}
    </ul>
  );
}
