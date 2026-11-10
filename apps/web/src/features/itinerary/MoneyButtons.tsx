import type { FxSnapshot } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { cachedFx } from '../../data/services/fxService';
import { convertMoney, moneyCodes, moneyLabel, moneyText } from '../../domain/memoFx';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button } from '../../shared/ui';

/**
 * 메모 옆 [원][달러][엔] (사용자 요청 2026-11-10): 누르면 금액을 받아 메모에 "1,000엔"처럼 넣는다.
 * 환전 가격은 저장하지 않고 입력칸 아래·일정 상세에서 그때 환율로 보여 준다 (MemoFx, 금액 저장 안 함 규칙)
 */
export function MoneyButtons({
  tripCurrency,
  onInsert,
}: {
  tripCurrency: string | undefined;
  onInsert: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [fx, setFx] = useState<FxSnapshot | null>(null);
  useEffect(() => {
    if (code) void cachedFx().then(setFx);
  }, [code]);
  const amount = Number(value.replace(/,/g, ''));
  const valid = Number.isFinite(amount) && amount > 0;
  const preview =
    code && valid && fx ? convertMoney({ code, amount }, fx.rates, tripCurrency) : null;
  const previewText = preview && moneyText(preview.code, preview.amount);
  const label = code ? (moneyLabel(code) ?? code) : '';
  const done = () => {
    const text = code && valid ? moneyText(code, amount) : null;
    if (text) onInsert(text);
    setCode(null);
    setValue('');
  };
  return (
    <>
      <span role="group" aria-label={t('money.group')} className="flex gap-1">
        {moneyCodes(tripCurrency).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCode(c)}
            aria-label={t('money.addOf', { name: moneyLabel(c) ?? c })}
            className="flex h-8 min-w-11 items-center justify-center rounded-full border border-line px-2.5 text-caption font-medium text-fg-sub"
          >
            {moneyLabel(c)}
          </button>
        ))}
      </span>
      <BottomSheet
        open={code !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCode(null);
            setValue('');
          }
        }}
        title={t('money.title', { name: label })}
      >
        <form
          className="flex flex-col gap-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            done();
          }}
        >
          <label className="flex items-center gap-2 rounded-btn border border-line bg-surface px-3">
            <span className="sr-only">{t('money.amount')}</span>
            <input
              inputMode="decimal"
              enterKeyHint="done"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
              className="tabular h-12 min-w-0 flex-1 bg-transparent text-body-1 outline-none"
            />
            <span className="shrink-0 text-body-2 text-fg-sub">{label}</span>
          </label>
          {/* 넣기 전에 바로 환전 가격 (괄호 안 모양 그대로) */}
          <p aria-live="polite" className="tabular min-h-5 text-caption text-fg-sub">
            {previewText ? t('money.preview', { to: previewText }) : ''}
          </p>
          <Button type="submit" fullWidth disabled={!valid}>
            {t('money.insert')}
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
