import { useCallback, useEffect, useState } from 'react';

export type PositionState =
  | { status: 'idle' }
  | { status: 'asking' }
  | { status: 'ok'; coords: { lat: number; lng: number } }
  | { status: 'denied' }
  | { status: 'unavailable' };

/** 다시 묻는 간격 — 여행 중 위치는 몇 분마다면 충분 (배터리) */
const REFRESH_MS = 3 * 60 * 1000;

/**
 * 지금 내 위치 (일정 화면 "다음 일정" 줄, 사용자 요청 2026-10-27).
 * 이미 허락했으면 바로·몇 분마다 읽고, 아니면 request()를 부를 때(버튼) 묻는다.
 * 좌표는 화면에서만 쓰고 기기 저장소에도 남기지 않는다 (CLAUDE.md 위치 규칙)
 */
export function useCurrentPosition(enabled: boolean): {
  state: PositionState;
  request: () => void;
} {
  const [state, setState] = useState<PositionState>({ status: 'idle' });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unavailable' });
      return;
    }
    // 이전 위치를 지운다 — 다시 누르면 새 위치로만 찾게 (옛 위치로 API를 부르지 않게)
    setState({ status: 'asking' });
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setState({ status: 'ok', coords: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      (e) => setState({ status: e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    );
  }, []);

  // 이미 허락한 기기는 묻지 않고 바로, 그리고 몇 분마다
  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let alive = true;
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((p) => {
        if (!alive || p.state !== 'granted') return;
        request();
        timer = window.setInterval(request, REFRESH_MS);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [enabled, request]);

  return { state, request };
}
