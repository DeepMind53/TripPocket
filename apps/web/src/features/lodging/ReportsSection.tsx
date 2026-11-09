import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { isStale, type ArrangedReport } from '../../domain/lodgingReports';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { formatMonthDay } from '../../shared/lib/dateFormat';

export type ReportsState =
  | { status: 'idle' | 'loading' | 'offline' | 'error' }
  | { status: 'ready'; same: ArrangedReport[]; other: ArrangedReport[] };

/**
 * 다른 사람들이 본 가격 · 30일 (docs/28 §6.2). 같은 날짜·인원 먼저 싼 순, 다른 날짜는 접어 둔다.
 * 누가 적었는지는 없고 내 기록에만 [삭제]
 */
export function ReportsSection({
  state,
  today,
  label,
  onDelete,
}: {
  state: ReportsState;
  today: string;
  /** 앱·경로 이름 ("아고다 · 신한카드") */
  label: (r: ArrangedReport) => string;
  onDelete: (r: ArrangedReport) => void;
}) {
  const { t } = useTranslation();
  const [showOther, setShowOther] = useState(false);
  return (
    <section aria-label={t('lodgingPrice.reports.title')} className="flex flex-col gap-2">
      <h3 className="text-body-1 font-semibold">{t('lodgingPrice.reports.title')}</h3>
      {state.status === 'loading' && (
        <p className="text-caption text-fg-muted">{t('lodgingPrice.reports.loading')}</p>
      )}
      {(state.status === 'offline' || state.status === 'error') && (
        <p className="rounded-card bg-bg-subtle px-3 py-3 text-caption whitespace-pre-line text-fg-sub">
          {t(
            state.status === 'offline'
              ? 'lodgingPrice.reports.offline'
              : 'lodgingPrice.reports.error',
          )}
        </p>
      )}
      {state.status === 'ready' && (
        <>
          {state.same.length === 0 ? (
            <p className="rounded-card bg-bg-subtle px-3 py-3 text-caption whitespace-pre-line text-fg-sub">
              {t('lodgingPrice.reports.empty')}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-card border border-line px-3">
              {state.same.map((r, i) => (
                <Row
                  key={r.id}
                  r={r}
                  best={i === 0 && !r.odd && r.nightlyKrw !== null}
                  today={today}
                  label={label(r)}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
          {state.other.length > 0 && (
            <>
              <button
                type="button"
                aria-expanded={showOther}
                onClick={() => setShowOther((v) => !v)}
                className="flex min-h-10 items-center text-caption font-semibold text-primary"
              >
                {t('lodgingPrice.reports.other', { n: state.other.length })}
              </button>
              {showOther && (
                <ul className="flex flex-col divide-y divide-line rounded-card border border-line px-3">
                  {state.other.map((r) => (
                    <Row
                      key={r.id}
                      r={r}
                      best={false}
                      today={today}
                      label={label(r)}
                      onDelete={onDelete}
                      showStay
                    />
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="text-caption whitespace-pre-line text-fg-muted">
            {t('lodgingPrice.reports.note')}
          </p>
        </>
      )}
    </section>
  );
}

function Row({
  r,
  best,
  today,
  label,
  onDelete,
  showStay = false,
}: {
  r: ArrangedReport;
  best: boolean;
  today: string;
  label: string;
  onDelete: (r: ArrangedReport) => void;
  showStay?: boolean;
}) {
  const { t } = useTranslation();
  const stale = isStale(r.seenOn, today);
  const fmt = new Intl.NumberFormat('ko');
  const price =
    r.nightlyKrw !== null
      ? t('lodgingPrice.reports.nightlyKrw', { price: fmt.format(r.nightlyKrw) })
      : t('lodgingPrice.reports.nightlyRaw', {
          price: fmt.format(r.priceType === 'total' ? Math.round(r.price / r.nights) : r.price),
          currency: r.currency,
        });
  const notes = [
    r.converted && t('lodgingPrice.reports.converted'),
    t(`lodgingPrice.reports.tax.${r.tax}`),
    ...r.tags.map((tag) => t(`lodgingPrice.tag.${tag}`)),
    r.odd && t('lodgingPrice.reports.odd'),
    stale && t('lodgingPrice.reports.stale'),
  ].filter(Boolean);
  return (
    <li className={cn('flex min-h-12 items-center gap-2 py-1.5', stale && 'opacity-60')}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5">
          {best && (
            <span className="shrink-0 rounded-full bg-primary-weak px-1.5 text-micro font-semibold text-primary">
              {t('lodgingPrice.reports.best')}
            </span>
          )}
          <span className="truncate text-body-2 font-medium">{label}</span>
        </span>
        <span className="truncate text-micro text-fg-muted">{notes.join(' · ')}</span>
        {showStay && (
          <span className="tabular text-micro text-fg-muted">
            {t('lodgingPrice.reports.stay', {
              from: formatMonthDay(r.checkIn),
              nights: r.nights,
              adults: r.adults,
            })}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="tabular text-body-2 font-semibold">{price}</span>
        <span className="tabular text-micro text-fg-muted">
          {r.mine
            ? t('lodgingPrice.reports.mineOn', { date: formatMonthDay(r.seenOn) })
            : formatMonthDay(r.seenOn)}
        </span>
      </span>
      {r.mine && (
        <button
          type="button"
          aria-label={t('lodgingPrice.reports.delete', { name: label })}
          onClick={() => onDelete(r)}
          className="grid size-10 shrink-0 place-items-center rounded-btn text-fg-muted"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      )}
    </li>
  );
}
