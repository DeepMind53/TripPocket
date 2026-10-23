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

/** 여행지 시간대가 이 기기와 다를 때만 "현지 14:05" (같으면 null) */
export function localTimeLabel(
  timezone: string,
  now: Date,
  t: (key: 'labs.localTime', o: { time: string }) => string,
): string | null {
  const fmt = (tz?: string) =>
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      ...(tz ? { timeZone: tz } : {}),
    }).format(now);
  try {
    const local = fmt(timezone);
    return local === fmt() ? null : t('labs.localTime', { time: local });
  } catch {
    return null; // 알 수 없는 시간대
  }
}
