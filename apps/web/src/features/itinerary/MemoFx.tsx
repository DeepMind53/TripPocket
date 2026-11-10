import { InlineIcon } from '../../shared/ui/InlineIcon';
import { Wallet } from 'lucide-react';
import { COUNTRY_CURRENCY, type FxSnapshot } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { cachedFx } from '../../data/services/fxService';
import { convertMoney, memoAmounts, moneyText } from '../../domain/memoFx';
import { useTranslation } from '../../i18n';

/**
 * 메모 속 금액 환산 (2026-10-27 정식, 2026-11-10 원화 → 여행 나라 돈 추가): "¥1,200 (≈ 11,040원)", "1,000원 (≈ 108엔)".
 * 일정 상세와 메모 입력칸 아래. 저장해 둔 환율(기기)만 쓰고 새로 부르지 않는다. 금액은 저장하지 않는다 (계산만)
 */
export function MemoFx({ memo, countryCode }: { memo: string; countryCode?: string | undefined }) {
  const { t } = useTranslation();
  const [fx, setFx] = useState<FxSnapshot | null>(null);
  useEffect(() => {
    void cachedFx().then(setFx);
  }, []);
  if (!fx) return null;
  const trip = countryCode ? COUNTRY_CURRENCY[countryCode] : undefined;
  const rows = memoAmounts(memo, trip).flatMap((a) => {
    const to = convertMoney(a, fx.rates, trip);
    const text = to && moneyText(to.code, to.amount);
    return text ? [{ from: a.text, to: text }] : [];
  });
  if (!rows.length) return null;
  return (
    <ul aria-label={t('labs.memoFxLabel')} className="mt-1 flex flex-col gap-0.5">
      {rows.map((r, i) => (
        <li key={`${i}-${r.from}`} className="tabular text-caption text-fg-sub">
          <InlineIcon icon={Wallet} />
          {t('labs.memoFxRow', { from: r.from, to: r.to })}
        </li>
      ))}
    </ul>
  );
}
