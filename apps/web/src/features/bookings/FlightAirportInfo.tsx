import type { Booking } from '@trippocket/shared';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { AirportResult } from '../../data/api/flights';
import { flightsApi } from '../../data/api/flights';
import { saveFlightAirport, useFlightAirport } from '../../data/flightAirportStore';
import { useTranslation } from '../../i18n';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { toast } from '../../shared/ui';

/** 공공데이터포털로 정보를 받는 국내 공항 (인천 + 한국공항공사 14곳) */
const KOREAN_AIRPORTS = new Set([
  'ICN',
  'GMP',
  'PUS',
  'CJU',
  'TAE',
  'CJJ',
  'KWJ',
  'RSU',
  'USN',
  'KPO',
  'WJU',
  'YNY',
  'MWX',
  'HIN',
  'KUV',
]);
const code = (place?: string) => {
  const c = place?.trim().toUpperCase().slice(0, 3);
  return c && /^[A-Z]{3}$/.test(c) ? c : undefined;
};

/**
 * 항공 예약 카드의 "공항 정보" 줄 (사용자 요청 2026-11-02): 국내 공항에서 출발·도착하는 편이면
 * 터미널·체크인 카운터(인천)·게이트·수하물 수취대를 불러온다. 확인 시각을 함께 보여 주고 전날 다시 확인하라고 안내
 */
export function FlightAirportInfo({ booking: b }: { booking: Booking }) {
  const { t } = useTranslation();
  const saved = useFlightAirport((s) => s[b.id]);
  const [busy, setBusy] = useState(false);
  const flightNo = b.details?.flightNo?.replace(/\s+/g, '').toUpperCase();
  const from = code(b.start.place);
  const to = code(b.end?.place);
  const domestic = [from, to].filter((c): c is string => !!c && KOREAN_AIRPORTS.has(c));
  if (!flightNo || domestic.length === 0) return null;
  // 편명·날짜가 바뀌었으면 예전 확인 결과는 보여 주지 않는다
  const report = saved && saved.flightNo === flightNo && saved.date === b.start.date ? saved : null;

  async function check() {
    setBusy(true);
    const res = await flightsApi.airport(flightNo!, {
      date: b.start.date,
      ...(from && KOREAN_AIRPORTS.has(from) ? { from } : {}),
      ...(to && KOREAN_AIRPORTS.has(to) ? { to } : {}),
      ...(b.end?.date ? { arrDate: b.end.date } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      toast(t('flightAirport.failed'));
      return;
    }
    saveFlightAirport(b.id, { ...res.data, flightNo: flightNo!, date: b.start.date });
  }

  const line = (role: 'dep' | 'arr', r: AirportResult) => {
    if (!r) return null;
    const label = t(`flightAirport.${role}`);
    if (r.from)
      return (
        <li key={role} className="text-caption text-fg-muted">
          {label} · {t('flightAirport.from', { date: formatMonthDay(r.from) })}
        </li>
      );
    if (!r.info)
      return (
        <li key={role} className="text-caption text-fg-muted">
          {label} · {t('flightAirport.none')}
        </li>
      );
    const i = r.info;
    const parts = [
      i.terminal,
      i.counter && t('flightAirport.counter', { v: i.counter }),
      i.gate && t('flightAirport.gate', { v: i.gate }),
      i.carousel && t('flightAirport.carousel', { v: i.carousel }),
      i.exit && t('flightAirport.exit', { v: i.exit }),
      i.estimated && i.estimated !== i.scheduled && t('flightAirport.changed', { v: i.estimated }),
      i.status,
    ].filter(Boolean);
    return (
      <li key={role} className="text-caption">
        <span className="font-semibold">
          {label} {i.airport}
        </span>{' '}
        <span className="text-fg-sub">{parts.join(' · ')}</span>
      </li>
    );
  };

  const checked = report ? new Date(report.checkedAt) : null;
  return (
    <div className="flex flex-col gap-1 border-t border-dashed border-line px-4 py-2">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 items-center text-caption font-semibold text-fg-sub">
          {t('flightAirport.title')}
        </span>
        {/* 확인 시각·재확인 안내는 버튼 바로 아래에 짧게 (사용자 요청 2026-11-03) */}
        <span className="flex flex-col items-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => void check()}
            className="flex h-9 items-center gap-1 text-caption font-semibold text-primary disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`size-3.5 ${busy ? 'animate-spin' : ''}`} />
            {report ? t('flightAirport.recheck') : t('flightAirport.check')}
          </button>
          {checked && (
            <span className="tabular -mt-1 text-right text-micro whitespace-pre-line text-warning">
              {t('flightAirport.checkedAt', {
                at: `${checked.getMonth() + 1}.${String(checked.getDate()).padStart(2, '0')} ${String(checked.getHours()).padStart(2, '0')}:${String(checked.getMinutes()).padStart(2, '0')}`,
              })}
            </span>
          )}
        </span>
      </div>
      {report ? (
        <ul className="flex flex-col gap-0.5">
          {line('dep', report.dep)}
          {line('arr', report.arr)}
        </ul>
      ) : (
        <p className="text-micro text-fg-muted">{t('flightAirport.hint')}</p>
      )}
    </div>
  );
}
