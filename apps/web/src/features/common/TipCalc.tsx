import { useState } from 'react';
import { tipOf } from '../../domain/travelExtras';
import { useTranslation } from '../../i18n';
import { Chip } from '../../shared/ui';

/** 팁 비율 (미국·캐나다 식당 기준 흔한 값) */
const PERCENTS = [10, 15, 18, 20] as const;

/**
 * 실험실 "팁 계산기" (2026-10-27): 금액 × 비율 → 팁·합계. 계산만 하고 저장하지 않는다 (가계부 아님)
 */
export function TipCalc() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [pct, setPct] = useState<number>(18);
  const n = Number(amount.replace(/,/g, ''));
  const r = Number.isFinite(n) && n > 0 ? tipOf(n, pct) : null;
  return (
    <section
      aria-label={t('labs.tipTitle')}
      className="flex flex-col gap-2 rounded-card bg-bg-subtle p-3"
    >
      <h3 className="text-caption font-bold text-fg-muted">💵 {t('labs.tipTitle')}</h3>
      <input
        inputMode="decimal"
        aria-label={t('labs.tipAmount')}
        placeholder={t('labs.tipAmount')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="tabular h-11 rounded-btn bg-surface px-3 text-body-1"
      />
      <div className="flex gap-2">
        {PERCENTS.map((p) => (
          <Chip key={p} selected={p === pct} onClick={() => setPct(p)}>
            {p}%
          </Chip>
        ))}
      </div>
      {r && (
        <p role="status" className="tabular text-body-2">
          {t('labs.tipResult', { tip: r.tip.toFixed(2), total: r.total.toFixed(2) })}
        </p>
      )}
    </section>
  );
}
