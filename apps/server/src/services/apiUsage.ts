import type { Db } from '../db/database';

/**
 * 외부 API 사용량 기록·자동 중지 (관리자 "API 사용량" 화면).
 * - 날짜별로 센다 (UTC 날짜). 이번 달 합계 = 1일부터 누적
 * - 과금될 수 있는 API는 무료 월 사용량의 90%에서 자동으로 멈춘다 (관리자가 상한을 바꿀 수 있음)
 * - 관리자가 언제든 수동으로 멈추고 다시 켤 수 있다 (무료 API 포함)
 */
export type ApiId =
  | 'google_places_search'
  | 'google_places_details'
  | 'google_maps_js'
  | 'naver_search'
  | 'gemini'
  | 'workers-ai'
  | 'groq'
  | 'kakao_local'
  | 'exim';

export interface ApiDef {
  id: ApiId;
  /** paid = 무료 사용량을 넘으면 요금이 나갈 수 있음 / free = 넘으면 막힐 뿐 과금 없음 */
  group: 'paid' | 'free';
  /** 무료 월 사용량 (호출 수). 모르면 없음 */
  freeMonthly?: number;
}

export const APIS: readonly ApiDef[] = [
  // Google Maps Platform (결제 계정 연결됨) — 2025-03 정책: SKU별 월 무료 사용량
  { id: 'google_places_search', group: 'paid', freeMonthly: 5000 },
  { id: 'google_places_details', group: 'paid', freeMonthly: 1000 },
  { id: 'google_maps_js', group: 'paid', freeMonthly: 10000 },
  // NAVER API HUB: 현재 한시적 무료(월 77.5만 회, 넘으면 차단), 유료 전환 예정 → 미리 관리
  { id: 'naver_search', group: 'paid', freeMonthly: 775000 },
  // 무료 등급 — 한도에 닿으면 거절될 뿐 결제 수단이 없어 과금되지 않음
  { id: 'gemini', group: 'free' },
  { id: 'workers-ai', group: 'free' },
  { id: 'groq', group: 'free' },
  { id: 'kakao_local', group: 'free' },
  { id: 'exim', group: 'free' },
];

const AUTO_RATIO = 0.9;
const def = (id: ApiId) => APIS.find((a) => a.id === id)!;
const day = () => new Date().toISOString().slice(0, 10);
const month = () => day().slice(0, 7);

/** 관리자가 멈춘 API — 호출하려던 쪽이 잡아서 "지금은 쓸 수 없음"으로 처리 */
export class ApiPaused extends Error {
  constructor(readonly api: ApiId) {
    super(`api_paused:${api}`);
  }
}

let db: Db | null = null;
/** 서버 시작 때 한 번 (app.ts). 시험에서 DB 없이 서비스 함수를 부를 때는 기록하지 않고 늘 허용 */
export function initApiUsage(d: Db): void {
  db = d;
}

interface Control {
  paused: boolean;
  autoLimit: number | null;
}
function control(id: ApiId): Control {
  const row = db!.prepare('SELECT paused, auto_limit FROM api_controls WHERE api = ?').get(id) as
    { paused: number; auto_limit: number | null } | undefined;
  const d = def(id);
  const fallback = d.freeMonthly ? Math.floor(d.freeMonthly * AUTO_RATIO) : null;
  return { paused: !!row?.paused, autoLimit: row?.auto_limit ?? fallback };
}

function monthCount(id: ApiId): number {
  return (
    (
      db!
        .prepare('SELECT SUM(count) AS n FROM api_usage WHERE api = ? AND date LIKE ?')
        .get(id, `${month()}-%`) as { n: number | null }
    ).n ?? 0
  );
}

/** 지금 불러도 되나: 수동 중지 아님 + (과금 가능 API는) 이번 달 자동 상한 전 */
export function apiAllowed(id: ApiId): boolean {
  if (!db) return true;
  const c = control(id);
  if (c.paused) return false;
  return c.autoLimit === null || monthCount(id) < c.autoLimit;
}

/** 부르기 전에: 막혀 있으면 ApiPaused */
export function guardApi(id: ApiId): void {
  if (!apiAllowed(id)) throw new ApiPaused(id);
}

export function trackApi(id: ApiId, n = 1): void {
  if (!db) return;
  db.prepare(
    `INSERT INTO api_usage (api, date, count) VALUES (?, ?, ?)
     ON CONFLICT (api, date) DO UPDATE SET count = count + excluded.count`,
  ).run(id, day(), n);
}

export function setApiPaused(id: ApiId, paused: boolean): void {
  db!
    .prepare(
      `INSERT INTO api_controls (api, paused) VALUES (?, ?)
       ON CONFLICT (api) DO UPDATE SET paused = excluded.paused`,
    )
    .run(id, paused ? 1 : 0);
}

/** 자동 중지 상한 (이번 달 호출 수). null = 기본값(무료 사용량의 90%) */
export function setApiLimit(id: ApiId, limit: number | null): void {
  db!
    .prepare(
      `INSERT INTO api_controls (api, auto_limit) VALUES (?, ?)
       ON CONFLICT (api) DO UPDATE SET auto_limit = excluded.auto_limit`,
    )
    .run(id, limit);
}

export const isApiId = (v: string): v is ApiId => APIS.some((a) => a.id === v);

/** 관리자 화면용: 이번 달 누적·오늘·하루별, 상태 */
export function usageReport() {
  const m = month();
  return {
    month: m,
    apis: APIS.map((a) => {
      const c = control(a.id);
      const used = monthCount(a.id);
      const daily = db!
        .prepare('SELECT date, count FROM api_usage WHERE api = ? AND date LIKE ? ORDER BY date')
        .all(a.id, `${m}-%`) as { date: string; count: number }[];
      return {
        id: a.id,
        group: a.group,
        freeMonthly: a.freeMonthly ?? null,
        autoLimit: c.autoLimit,
        used,
        today: daily.find((d) => d.date === day())?.count ?? 0,
        daily,
        paused: c.paused,
        autoStopped: !c.paused && c.autoLimit !== null && used >= c.autoLimit,
      };
    }),
  };
}
