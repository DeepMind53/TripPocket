import * as z from 'zod/mini';
import { CoordsSchema } from '../schema/common';

export type Coords = z.infer<typeof CoordsSchema>;

/** 두 장소 사이 소요 시간(분) — 길이 없으면 비움. source: google = Google Routes, osm = Geoapify */
export interface RouteEta {
  walk?: number | undefined;
  transit?: number | undefined;
  /** 자동차(분)·거리(km) — drive 요청에만 (사용자 요청 2026-11-13, [자동차]를 고를 때만 조회) */
  drive?: number | undefined;
  driveKm?: number | undefined;
  source: 'google' | 'osm';
  /** 오늘 남은 길 조회 수 (한 사람 하루 50번, 2026-11-10) — 기기에 보관한 결과에는 없다 */
  left?: number | undefined;
}

/**
 * POST /api/routes/eta 본문 (실험실 "출발 시각", 2026-10-26).
 * google = 둘 중 하나라도 Google에서 받은 좌표 → 서버가 Google Routes만 쓴다 (Google 약관)
 */
export const RouteEtaBody = z.object({
  from: CoordsSchema,
  to: CoordsSchema,
  google: z.boolean(),
  /** 출발점이 지금 내 위치 — 서버는 이 요청을 어디에도 보관하지 않는다 (CLAUDE.md 위치 규칙) */
  live: z.optional(z.boolean()),
  /** 자동차 길만 (사용자가 [자동차]를 고를 때, 2026-11-13) — 걷기·대중교통은 부르지 않는다 */
  drive: z.optional(z.boolean()),
});
