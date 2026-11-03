import { todayIn, type Booking } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { api } from '../../data/api/client';
import { useLab } from '../../data/labsStore';
import { useTranslation } from '../../i18n';

interface Status {
  status: string;
  depDelay?: number;
  arrDelay?: number;
}

/**
 * 실험실 "항공편 지연" (docs/26 B2, 2026-11-03): 출발 당일 항공 예약 카드에 AirLabs 지연 정보.
 * 무료 월 1,000회라 출발 당일 카드를 볼 때만 묻는다 (서버가 10분 기억). 편명만 보낸다
 */
export function FlightDelay({ booking: b }: { booking: Booking }) {
  const on = useLab('flightDelay');
  const no = b.details?.flightNo?.replace(/\s+/g, '').toUpperCase();
  const today = todayIn(b.start.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (!on || !no || b.start.date !== today) return null;
  return <Line no={no} />;
}

function Line({ no }: { no: string }) {
  const { t } = useTranslation();
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    let alive = true;
    void api<{ status: Status | null }>(`/api/info/flight/${no}`).then(
      (r) => alive && r.ok && setS(r.data.status),
    );
    return () => {
      alive = false;
    };
  }, [no]);
  if (!s) return null;
  return (
    <p
      className={`border-t border-dashed border-line px-4 py-1.5 text-caption font-semibold ${
        s.depDelay ? 'text-warning' : 'text-fg-sub'
      }`}
    >
      {s.depDelay ? t('flightDelay.delayed', { min: s.depDelay }) : t('flightDelay.onTime')}
      <span className="ml-1 text-micro font-normal text-fg-muted">{t('flightDelay.source')}</span>
    </p>
  );
}
