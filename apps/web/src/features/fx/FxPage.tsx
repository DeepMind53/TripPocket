import {
  COUNTRY_CURRENCY,
  fromKrw,
  HUNDRED_UNIT,
  POPULAR_CURRENCIES,
  toKrw,
} from '@trippocket/shared';
import { ArrowUpDown, ChevronDown, Delete, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTrip } from '../../data/hooks';
import { cachedFx, getFx, type FxResult } from '../../data/services/fxService';
import { useSettings } from '../../data/settingsStore';
import { useTranslation } from '../../i18n';
import { copyText } from '../../shared/lib/clipboard';
import { cn } from '../../shared/lib/cn';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { BottomSheet, Chip, TopBar } from '../../shared/ui';

const currencyName = (code: string) => {
  try {
    return new Intl.DisplayNames(['ko'], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
};
const symbol = (code: string) =>
  new Intl.NumberFormat('ko', {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
  })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? code;
const digits = (code: string) =>
  new Intl.NumberFormat('ko', { style: 'currency', currency: code }).resolvedOptions()
    .maximumFractionDigits ?? 2;
const fmt = (n: number, max: number) =>
  new Intl.NumberFormat('ko', { maximumFractionDigits: max }).format(n);

/** S-51 환율 계산기 (docs/12 §2.4) — 조회·계산만, 금액은 저장하지 않는다 */
export function FxPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const trip = useTrip(params.get('trip') ?? '');
  const tripCurrencies = useMemo(
    () => [
      ...new Set(
        (trip?.destinations ?? [])
          .map((d) => (d.countryCode ? COUNTRY_CURRENCY[d.countryCode] : undefined))
          .filter((c): c is string => !!c && c !== 'KRW'),
      ),
    ],
    [trip],
  );
  // 고른 통화 > 주소의 통화 > 여행 나라 통화 > 엔화
  const [picked, setCurrency] = useState<string | null>(params.get('currency'));
  const currency = picked ?? tripCurrencies[0] ?? 'JPY';
  const [fx, setFx] = useState<FxResult | null>(null);
  const [input, setInput] = useState('');
  const [krwFirst, setKrwFirst] = useState(false);
  const [pickerOpen, setPickerOpen] = useRouteSheet('currency');
  const { fxFeeEnabled, fxFeePercent } = useSettings();
  const fee = fxFeeEnabled ? fxFeePercent : 0;

  useEffect(() => {
    void cachedFx().then((c) => c && setFx((cur) => cur ?? { ...c, stale: true }));
    void getFx().then(setFx);
  }, []);

  const rate = fx?.rates[currency];
  const amount = Number(input || '0');
  const topCode = krwFirst ? 'KRW' : currency;
  const bottomCode = krwFirst ? currency : 'KRW';
  const result = rate ? (krwFirst ? fromKrw(amount, rate, fee) : toKrw(amount, rate, fee)) : null;
  const unit = HUNDRED_UNIT.has(currency) ? 100 : 1;
  const quick = krwFirst
    ? [10_000, 50_000, 100_000, 500_000]
    : unit === 100
      ? [1_000, 5_000, 10_000, 50_000]
      : [10, 50, 100, 500];

  const press = (key: string) => {
    if (key === 'del') return setInput((v) => v.slice(0, -1));
    if (key === '.' && (input.includes('.') || digits(topCode) === 0)) return;
    setInput((v) => (v + key).replace(/^0+(?=\d)/, '').slice(0, 12));
  };
  const keys = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    digits(topCode) > 0 ? '.' : '00',
    '0',
    'del',
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <TopBar title={t('fx.title')} backTo="/" />
      <div className="flex flex-1 flex-col gap-3 px-5 pt-2 pb-4">
        {tripCurrencies.length > 1 && (
          <div className="flex gap-2">
            {tripCurrencies.map((c) => (
              <Chip key={c} selected={c === currency} onClick={() => setCurrency(c)}>
                {c}
              </Chip>
            ))}
          </div>
        )}
        <AmountRow
          label={topCode === 'KRW' ? t('fx.krw') : `${currencyName(currency)} ${currency}`}
          value={`${symbol(topCode)} ${input ? fmt(Number(input), digits(topCode)) : '0'}`}
          active
          onPick={topCode === 'KRW' ? undefined : () => setPickerOpen(true)}
        />
        <button
          type="button"
          aria-label={t('fx.swap')}
          onClick={() => {
            setKrwFirst((v) => !v);
            setInput(result ? String(Math.round(result * 100) / 100) : '');
          }}
          className="mx-auto grid size-10 place-items-center rounded-full bg-bg-subtle text-primary"
        >
          <ArrowUpDown aria-hidden="true" className="size-5" />
        </button>
        <AmountRow
          label={bottomCode === 'KRW' ? t('fx.krw') : `${currencyName(currency)} ${currency}`}
          value={result === null ? '—' : `${symbol(bottomCode)} ${fmt(result, digits(bottomCode))}`}
          onCopy={
            result === null
              ? undefined
              : () => void copyText(fmt(result, digits(bottomCode)), t('fx.copied'))
          }
          onPick={bottomCode === 'KRW' ? undefined : () => setPickerOpen(true)}
        />
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <Chip key={q} onClick={() => setInput(String(q))}>
              {symbol(topCode)}
              {fmt(q, 0)}
            </Chip>
          ))}
        </div>

        <div aria-live="polite" className="flex flex-col gap-0.5 text-caption text-fg-sub">
          {rate ? (
            <span className="tabular text-body-2 font-semibold text-fg">
              {symbol(currency)}
              {unit} = {fmt(toKrw(unit, rate, fee), 2)}
              {t('fx.won')}
            </span>
          ) : (
            <span>{fx ? t('fx.noRate', { code: currency }) : t('fx.loading')}</span>
          )}
          {fx && (
            <span className={cn(fx.stale && 'text-fg-muted')}>
              {t(fx.source === 'koreaexim' ? 'fx.sourceExim' : 'fx.sourceFallback')} · {fx.date}
              {fx.stale && ` · ${t('fx.stale')}`}
            </span>
          )}
          {fee > 0 && <span>{t('fx.feeApplied', { fee })}</span>}
          <span className="text-fg-muted">{t('fx.notRealtime')}</span>
          <a
            href={`https://search.naver.com/search.naver?query=${encodeURIComponent(`${currencyName(currency)} 환율`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 self-start font-semibold text-primary"
          >
            {t('fx.naver')}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </div>

        <Keypad keys={keys} onKey={press} onClear={() => setInput('')} />
      </div>

      <CurrencyPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        rates={fx?.rates ?? {}}
        first={tripCurrencies}
        onPick={(c) => {
          setCurrency(c);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function AmountRow(props: {
  label: string;
  value: string;
  active?: boolean;
  onPick?: (() => void) | undefined;
  onCopy?: (() => void) | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      {props.onPick ? (
        <button
          type="button"
          onClick={props.onPick}
          className="flex items-center gap-1 self-start text-caption font-semibold text-fg-sub"
        >
          {props.label}
          <ChevronDown aria-hidden="true" className="size-4" />
        </button>
      ) : (
        <span className="text-caption font-semibold text-fg-sub">{props.label}</span>
      )}
      <button
        type="button"
        onClick={props.onCopy}
        disabled={!props.onCopy && !props.active}
        aria-live={props.active ? undefined : 'polite'}
        className={cn(
          'tabular flex h-14 items-center justify-end rounded-card border px-4 text-title-1',
          props.active ? 'border-primary' : 'border-line bg-bg-subtle',
        )}
      >
        <span className="truncate">{props.value}</span>
      </button>
    </div>
  );
}

function Keypad({
  keys,
  onKey,
  onClear,
}: {
  keys: string[];
  onKey: (k: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const hold = useRef<number | undefined>(undefined);
  return (
    <div className="mt-auto grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={k === 'del' ? t('fx.delete') : k}
          onClick={() => onKey(k)}
          // ⌫ 길게 누르면 전부 지우기
          onPointerDown={() => {
            if (k === 'del') hold.current = window.setTimeout(onClear, 600);
          }}
          onPointerUp={() => window.clearTimeout(hold.current)}
          onPointerLeave={() => window.clearTimeout(hold.current)}
          className="tabular grid h-16 place-items-center rounded-card bg-bg-subtle text-title-2 active:bg-line"
        >
          {k === 'del' ? <Delete aria-hidden="true" className="size-6" /> : k}
        </button>
      ))}
    </div>
  );
}

function CurrencyPicker(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rates: Record<string, number>;
  first: string[];
  onPick: (code: string) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const all = Object.keys(props.rates).filter((c) => c !== 'KRW');
  const ordered = [...new Set([...props.first, ...POPULAR_CURRENCIES, ...all.sort()])].filter(
    (c) => c in props.rates,
  );
  const list = ordered.filter(
    (c) => !q || c.toLowerCase().includes(q.toLowerCase()) || currencyName(c).includes(q),
  );
  return (
    <BottomSheet open={props.open} onOpenChange={props.onOpenChange} title={t('fx.pick')}>
      <input
        type="search"
        aria-label={t('fx.search')}
        placeholder={t('fx.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-2 h-11 w-full rounded-btn bg-bg-subtle px-3 text-body-1 outline-none"
      />
      <ul className="flex flex-col divide-y divide-line">
        {list.slice(0, 60).map((c) => (
          <li key={c}>
            <button
              type="button"
              onClick={() => props.onPick(c)}
              className="flex min-h-12 w-full items-center gap-3 text-left"
            >
              <span className="tabular w-12 font-bold">{c}</span>
              <span className="flex-1 text-body-2">{currencyName(c)}</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
