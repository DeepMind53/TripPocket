import { api } from './client';

/**
 * 브라우저에서 직접 부르는 유료 가능 API(Google 지도) 사용량 — 서버 routes/usage.ts.
 * 서버에 닿지 않으면(오프라인·홈 PC 꺼짐) 허용: Google 콘솔의 하루 할당량이 마지막 안전장치
 */
export async function googleMapsAllowed(): Promise<boolean> {
  const res = await api<{ maps: boolean }>('/api/usage/flags');
  return res.ok ? res.data.maps : true;
}

/** 지도 1회 로드 기록 (실패해도 지도는 그대로) */
export function reportMapLoad(): void {
  void api('/api/usage/map-load', { method: 'POST' });
}
