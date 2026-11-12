import { useEffect, useState } from 'react';

/** 켜져 있으면 1분마다 바뀌는 지금 시각 (실험실 "현지 시각 표시") */
export function useMinuteClock(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

/** 그 시간대의 지금 "HH:MM" (24시간). 알 수 없는 시간대면 null */
export function timeIn(timezone: string, now: Date): string | null {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: timezone,
    }).format(now);
  } catch {
    return null;
  }
}
