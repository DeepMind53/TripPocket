import type { ReactNode } from 'react';

/** 미니맵에 필요한 일정 칸만 (샘플 미리보기도 같은 부품을 쓴다) */
export interface MiniMapItem {
  kind: string;
  place?:
    | { coords?: { lat: number; lng: number } | undefined; coordsSource?: string | undefined }
    | undefined;
}

const W = 56;
const H = 28;
const PAD = 4;

/**
 * 일차 노선 미니맵 (실험실 dayMiniMap, 2026-11-10): 일차 머리 옆에 그날 장소 위치를 노선 색 점·선으로.
 * 지도 API 없이 좌표만 쓴다 (요청 0). Google에서 받은 좌표는 Google 지도에만 (docs/10 §2.1) → 빼고 그린다.
 * 그림이라 스크린리더에는 숨긴다 (같은 정보가 아래 목록에 있음)
 */
export function DayMiniMap({
  items,
  fallback = null,
}: {
  items: readonly MiniMapItem[];
  /** 그릴 점이 2개보다 적을 때 대신 보일 것 */
  fallback?: ReactNode;
}) {
  const pts = items
    .filter((i) => i.kind !== 'note' && i.place?.coords && i.place.coordsSource !== 'google')
    .map((i) => i.place!.coords!);
  if (pts.length < 2) return fallback;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  // 경도는 위도에 따라 줄어든다 — 가로세로 비율을 지켜 한 칸 안에 맞춘다
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = Math.max((maxLng - minLng) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const s = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const ox = (W - spanX * s) / 2;
  const oy = (H - spanY * s) / 2;
  const xy = pts.map((p) => [ox + (p.lng - minLng) * kx * s, oy + (maxLat - p.lat) * s] as const);
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      className="h-7 w-14 shrink-0 rounded-md bg-bg-subtle"
    >
      <polyline
        points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="var(--route)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {xy.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="2.2"
          fill="var(--tp-surface)"
          stroke="var(--route-ink)"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}
