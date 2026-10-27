import {
  todayIn,
  upcomingTripCurrencies,
  fromKrw,
  HUNDRED_UNIT,
  POPULAR_CURRENCIES,
  toKrw,
} from '@trippocket/shared';
import { ArrowUpDown, ChevronDown, Delete, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTrip, useTrips } from '../../data/hooks';
import { cachedFx, getFx, type FxResult } from '../../data/services/fxService';
import { useSettings } from '../../data/settingsStore';
import { t, useTranslation, type TKey } from '../../i18n';
import { copyText } from '../../shared/lib/clipboard';
import { cn } from '../../shared/lib/cn';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { BottomSheet, Chip, TopBar } from '../../shared/ui';

/**
 * 통화 한국어 이름 (2026-10-28): 문구 파일의 이름표 → 없으면 브라우저 이름. 기기에 따라 브라우저가 약어만 돌려줘
 * "TWD TWD"처럼 보이거나 "신 타이완 달러"처럼 낯선 이름이 나와 이름표를 먼저 쓴다. 이름이 없으면 ''
 */
const currencyName = (code: string): string => {
  const key = `currencyName.${code}` as TKey;
  const named = t(key);
  if (named !== key) return named;
  try {
    const intl = new Intl.DisplayNames(['ko'], { type: 'currency' }).of(code);
    return intl && intl !== code ? intl : '';
  } catch {
    return '';
  }
};
/** "대만 달러 TWD" — 이름이 없으면 약어 한 번만 */
const currencyLabel = (code: string) => {
  const name = currencyName(code);
  return name ? `${name} ${code}` : code;
};
/**
 * 네이버 환율 검색어: 네이버 환율 계산기가 있는 통화는 "TWD 환율"처럼 약어로 (2026-10-28 47개 통화 확인 —
 * 칠레 페소만 약어로는 안 떠 이름으로). 계산기에 없는 통화는 이름으로 검색
 */
const NAVER_FX = new Set(
  'AED AUD BDT BHD BND BRL CAD CHF CNY CZK DKK EGP EUR GBP HKD HUF IDR ILS INR JOD JPY KWD KZT MNT MOP MXN MYR NOK NPR NZD OMR PHP PKR PLN QAR RUB SAR SEK SGD THB TRY TWD USD VND ZAR'.split(
    ' ',
  ),
);
const naverQuery = (code: string) =>
  `${NAVER_FX.has(code) ? code : currencyName(code) || code} 환율`;
/** 이보다 오래된 환율이면 그 통화를 고를 때 바로 새로 받는다 (주말 고시 공백은 넘김) */
const OLD_MS = 3 * 24 * 3600 * 1000;
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
  const trips = useTrips();
  // 여행 화면에서 열면 그 여행 나라, 아니면 진행 중·다가오는 여행 나라(가까운 순)
  const tripCurrencies = useMemo(
    () =>
      trip
        ? upcomingTripCurrencies([{ ...trip, endDate: '9999-12-31' }], '')
        : upcomingTripCurrencies(
            trips ?? [],
            todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone),
          ),
    [trip, trips],
  );
  // 고른 통화 > 주소의 통화 > 여행 나라 통화 > 엔화
  const [picked, setCurrency] = useState<string | null>(params.get('currency'));
  const currency = picked ?? tripCurrencies[0] ?? 'JPY';
  const [fx, setFx] = useState<FxResult | null>(null);
  /** 처음 받아 오기가 끝났나 (그 전엔 저장해 둔 값이라 오래됐어도 다시 받지 않는다) */
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [krwFirst, setKrwFirst] = useState(false);
  const [pickerOpen, setPickerOpen] = useRouteSheet('currency');
  const { fxFeeEnabled, fxFeePercent } = useSettings();
  const fee = fxFeeEnabled ? fxFeePercent : 0;

  useEffect(() => {
    void cachedFx().then((c) => c && setFx((cur) => cur ?? { ...c, stale: true }));
    void getFx().then((r) => {
      setFx(r);
      setLoaded(true);
    });
  }, []);

  // 고른 통화 환율이 오래됐으면(예: 국제 시세가 며칠 전 값) 그 자리에서 한 번 새로 받는다 (사용자 요청 2026-10-28)
  const refreshed = useRef(new Set<string>());
  useEffect(() => {
    if (!loaded || !fx || refreshed.current.has(currency)) return;
    const date =
      fx.source === 'koreaexim' && fx.fallback?.codes.includes(currency)
        ? fx.fallback.date
        : fx.date;
    if (!fx.stale && Date.now() - Date.parse(date) < OLD_MS) return;
    refreshed.current.add(currency);
    void getFx({ force: true }).then((r) => r && setFx(r));
  }, [currency, fx, loaded]);

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
          label={topCode === 'KRW' ? t('fx.krw') : currencyLabel(currency)}
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
          label={bottomCode === 'KRW' ? t('fx.krw') : currencyLabel(currency)}
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
              {fx.source === 'koreaexim' && fx.fallback?.codes.includes(currency)
                ? `${t('fx.sourceFallback')} · ${fx.fallback.date}`
                : `${t(fx.source === 'koreaexim' ? 'fx.sourceExim' : 'fx.sourceFallback')} · ${fx.date}`}
              {fx.stale && ` · ${t('fx.stale')}`}
            </span>
          )}
          {fee > 0 && <span>{t('fx.feeApplied', { fee })}</span>}
          <span className="text-fg-muted">{t('fx.notRealtime')}</span>
          <a
            href={`https://search.naver.com/search.naver?query=${encodeURIComponent(naverQuery(currency))}`}
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
  // 이름 없는 코드(가상화폐 등)는 빼고
  const ordered = [...new Set([...props.first, ...POPULAR_CURRENCIES, ...all.sort()])].filter(
    (c) => c in props.rates && !!currencyName(c),
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
