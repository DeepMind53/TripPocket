import { useEffect } from 'react';

interface WakeLockSentinel {
  release(): Promise<void>;
}
type WakeLockNav = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
};

/**
 * 켜져 있는 동안 화면이 꺼지지 않게 (실험실 "화면 켜짐 유지").
 * 다른 앱에 다녀오면 브라우저가 풀어 버리므로 화면이 다시 보일 때 다시 요청. 지원하지 않으면 아무것도 안 함
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    const wl = (navigator as WakeLockNav).wakeLock;
    if (!enabled || !wl) return;
    let sentinel: WakeLockSentinel | null = null;
    let alive = true;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      wl.request('screen').then(
        (s) => {
          if (alive) sentinel = s;
          else void s.release();
        },
        () => {}, // 배터리 절약 모드 등으로 거절 → 그냥 둔다
      );
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', request);
      void sentinel?.release();
    };
  }, [enabled]);
}
