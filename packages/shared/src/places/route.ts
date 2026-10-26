import * as z from 'zod/mini';
import { CoordsSchema } from '../schema/common';

export type Coords = z.infer<typeof CoordsSchema>;

/** 두 장소 사이 소요 시간(분) — 길이 없으면 비움. source: google = Google Routes, osm = Geoapify */
export interface RouteEta {
  walk?: number | undefined;
  transit?: number | undefined;
  source: 'google' | 'osm';
}

/**
 * POST /api/routes/eta 본문 (실험실 "출발 시각", 2026-10-26).
 * google = 둘 중 하나라도 Google에서 받은 좌표 → 서버가 Google Routes만 쓴다 (Google 약관)
 */
export const RouteEtaBody = z.object({
  from: CoordsSchema,
  to: CoordsSchema,
  google: z.boolean(),
});
