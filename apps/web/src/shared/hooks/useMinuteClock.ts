import { useEffect, useState } from 'react';

/**
 * 켜져 있으면 분이 바뀔 때마다 바뀌는 지금 시각 (여행 모드 현지 시각 등).
 * 2026-11-13 사용자 요청 "누른 시각에서 멈춰 있다": 연 시점부터 60초마다가 아니라 실제 분 경계(00초)에 맞춰 바꾸고,
 * 화면을 껐다 켜거나 다른 앱에서 돌아오면(백그라운드에서는 타이머가 멈춘다) 바로 다시 맞춘다
 */
export function useMinuteClock(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const tick = () => {
      const d = new Date();
      setNow(d);
      window.clearTimeout(timer);
      // 다음 분 00초 조금 뒤에
      timer = window.setTimeout(tick, 60_000 - (d.getTime() % 60_000) + 50);
    };
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const back = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    window.addEventListener('pageshow', back);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('focus', back);
      window.removeEventListener('pageshow', back);
    };
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
