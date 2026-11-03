import { BAGGAGE_CHECKED_AT, baggageFor, type Booking } from '@trippocket/shared';
import { ChevronDown, ExternalLink, Luggage } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n';

/**
 * 항공 예약 카드의 "수하물" 줄 (사용자 요청 2026-11-02): 항공사 대표값(일반석) + 공식 안내 링크 + 확인 날짜.
 * 운임·노선마다 달라서 예약에 적은 수하물(details.baggage)이 있으면 그것이 먼저다
 */
export function BaggageInfo({ booking: b }: { booking: Booking }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const info = baggageFor(b.provider, b.details?.flightNo);
  if (!info) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-dashed border-line px-4 py-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-1.5 text-left text-caption font-semibold text-fg-sub"
      >
        <Luggage aria-hidden="true" className="size-4 text-primary" />
        <span className="flex-1">{t('baggage.title', { name: info.name })}</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1 pb-1 text-caption">
          <p>
            <span className="font-semibold">{t('baggage.cabin')}</span> {info.cabin}
          </p>
          <p>
            <span className="font-semibold">{t('baggage.checked')}</span> {info.checked}
          </p>
          {info.note && <p className="text-warning">{info.note}</p>}
          {(info.tips || info.lcc) && (
            <p className="flex flex-col whitespace-pre-line text-fg-sub">
              <span className="font-semibold text-fg">{t('baggage.tips')}</span>
              {[info.tips, info.lcc && t('baggage.lccTips')].filter(Boolean).join('\n')}
            </p>
          )}
          <p className="text-micro whitespace-pre-line text-fg-muted">
            {t(info.official ? 'baggage.noteOfficial' : 'baggage.noteTypical', {
              date: BAGGAGE_CHECKED_AT,
            })}
          </p>
          <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-semibold text-primary"
          >
            {t('baggage.official')}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
