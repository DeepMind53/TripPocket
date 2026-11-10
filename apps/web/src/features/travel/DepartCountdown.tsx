import { useEffect, useState } from 'react';
import { leaveInSeconds } from '../../domain/travelDay';
import { useTranslation } from '../../i18n';

/** 그 시간대의 지금 = 하루의 몇 번째 초 */
function secondsIn(timezone: string, now: Date): number {
  try {
    const [h = 0, m = 0, s = 0] = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZone: timezone,
    })
      .format(now)
      .split(':')
      .map(Number);
    return h * 3600 + m * 60 + s;
  } catch {
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  }
}

/**
 * 여행 모드 "88분 38초 후 출발" (사용자 요청 2026-11-10): 고른 이동 수단으로 계산한 실제 출발 예상까지 1초마다.
 * 1초마다 다시 그리는 것은 이 글자만 (화면 전체가 아니라)
 */
export function DepartCountdown({
  start,
  timezone,
  travelMin,
}: {
  start: string;
  timezone: string;
  travelMin: number | undefined;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const sec = leaveInSeconds(start, secondsIn(timezone, now), travelMin);
  if (sec <= 0) return <span className="whitespace-nowrap">{t('travel.leaveNow')}</span>;
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="whitespace-nowrap">
        {t('travel.departIn', { m: Math.floor(sec / 60), s: sec % 60 })}
      </span>
      <span className="text-body-1 font-medium whitespace-nowrap opacity-90">
        {t('travel.departSuffix')}
      </span>
    </span>
  );
}
