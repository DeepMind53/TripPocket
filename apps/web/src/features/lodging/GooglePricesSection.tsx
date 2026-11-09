import type { HotelPricesView } from '@trippocket/shared';
import { ExternalLink } from 'lucide-react';
import type { PricesResult } from '../../data/hotelPrices';
import { useTranslation } from '../../i18n';

export type GooglePrices =
  | { status: 'loading' }
  | { status: 'ready'; hotel: HotelPricesView | null }
  | { status: 'failed'; reason: Exclude<Extract<PricesResult, { ok: false }>['reason'], 'off'> };

const SHOWN = 5;

/**
 * 구글 호텔 참고 가격 (docs/28 §4.3 B): 누르기 전에 대략 얼마인지 보는 참고용. 저장·기록하지 않는다.
 * 무료량이 끝나거나 못 불러오면 구글 호텔 검색 창을 여는 버튼 (Q8, 요청 0)
 */
export function GooglePricesSection({
  state,
  googleUrl,
}: {
  state: GooglePrices;
  googleUrl: string;
}) {
  const { t } = useTranslation();
  const won = (n: number) => new Intl.NumberFormat('ko').format(n);
  const hotel = state.status === 'ready' ? state.hotel : null;
  const prices = hotel?.prices ?? [];
  const row = (p: HotelPricesView['prices'][number], i: number) => (
    <li key={p.source} className="flex min-h-11 items-center gap-2 py-1">
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-body-2">{p.source}</span>
        {p.official && (
          <span className="shrink-0 rounded-btn bg-bg-subtle px-1.5 text-micro text-fg-sub">
            {t('lodgingPrice.google.official')}
          </span>
        )}
      </span>
      <span
        className={`tabular shrink-0 text-body-2 ${i === 0 ? 'font-semibold text-primary' : 'font-medium'}`}
      >
        {t('lodgingPrice.google.perNight', { price: won(p.nightlyKrw) })}
      </span>
    </li>
  );

  return (
    <section aria-label={t('lodgingPrice.google.title')} className="flex flex-col gap-2">
      <h3 className="text-body-1 font-semibold">{t('lodgingPrice.google.title')}</h3>
      {state.status === 'loading' && (
        <p role="status" className="rounded-card bg-bg-subtle px-3 py-3 text-caption text-fg-sub">
          {t('lodgingPrice.google.loading')}
        </p>
      )}
      {hotel && prices.length > 0 && (
        <>
          <p className="text-caption text-fg-sub">
            {t('lodgingPrice.google.matched', { name: hotel.name })}
          </p>
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line px-3">
            {prices.slice(0, SHOWN).map(row)}
          </ul>
          {prices.length > SHOWN && (
            <details className="rounded-card border border-line px-3">
              <summary className="flex min-h-11 cursor-pointer items-center text-caption font-semibold text-fg-sub">
                {t('lodgingPrice.google.more', { n: prices.length - SHOWN })}
              </summary>
              <ul className="flex flex-col divide-y divide-line">
                {prices.slice(SHOWN).map((p, i) => row(p, i + SHOWN))}
              </ul>
            </details>
          )}
          <p className="text-caption whitespace-pre-line text-fg-muted">
            {t('lodgingPrice.google.note')}
          </p>
        </>
      )}
      {(state.status === 'failed' || (state.status === 'ready' && prices.length === 0)) && (
        <p
          role="status"
          className="rounded-card bg-bg-subtle px-3 py-2 text-caption whitespace-pre-line text-fg-sub"
        >
          {t(`lodgingPrice.google.fail.${state.status === 'failed' ? state.reason : 'none'}`)}
        </p>
      )}
      {state.status !== 'loading' && (
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 items-center gap-1 self-start rounded-btn bg-primary-weak px-3 text-caption font-semibold text-primary"
        >
          {t('lodgingPrice.google.open')}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      )}
    </section>
  );
}
