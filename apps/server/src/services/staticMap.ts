import { guardApi, trackApi } from './apiUsage';

/** 지도에 찍을 점: 좌표 + 일정 목록 번호 */
export interface MapPoint {
  lat: number;
  lng: number;
  n: number;
}

/** 한 번에 그릴 점 상한 (주소 길이·지도 가독성) */
export const STATIC_MAP_MAX_POINTS = 25;

/**
 * 일정표 상세 출력의 일차 지도 (2026-11-25 사용자 결정): Google Maps Static API — 번호 핀 + 순서선.
 * Google 장소 좌표는 Google 지도에만 (docs/10 §2.1)이라 Google 지도 그림으로. 핀 글자는 한 글자만 되므로
 * 1~9는 숫자, 10번부터는 글자 없이 색 핀 (번호는 아래 일정 목록에)
 */
export function staticMapUrl(points: readonly MapPoint[], color: string): URL {
  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('size', '640x360');
  url.searchParams.set('scale', '2');
  url.searchParams.set('language', 'ko');
  const hex = `0x${color}`;
  for (const p of points) {
    const label = p.n >= 1 && p.n <= 9 ? `|label:${p.n}` : '';
    url.searchParams.append(
      'markers',
      `color:${hex}${label}|${p.lat.toFixed(6)},${p.lng.toFixed(6)}`,
    );
  }
  if (points.length > 1)
    url.searchParams.set(
      'path',
      `color:${hex}cc|weight:4|${points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|')}`,
    );
  return url;
}

/** 지도 그림 받기 — 키는 머리글 대신 주소에만 받는 API라 로그에 주소를 남기지 않는다 */
export async function fetchStaticMap(
  points: readonly MapPoint[],
  color: string,
  apiKey: string,
): Promise<{ type: string; body: Buffer }> {
  guardApi('google_static_maps');
  trackApi('google_static_maps');
  const url = staticMapUrl(points, color);
  url.searchParams.set('key', apiKey);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`static map ${res.status}`);
  return {
    type: res.headers.get('content-type') ?? 'image/png',
    body: Buffer.from(await res.arrayBuffer()),
  };
}
