import type { Db } from '../db/database';

/**
 * 외부 API 사용량 기록·자동 중지 (관리자 "API 사용량" 화면). 앱이 부르는 외부 API는 **모두** 여기 등록한다.
 * - 날짜별로 센다. 날짜는 그 API가 무료량을 다시 채우는 시간대 기준 (Google = 미국 태평양, 카카오 = 한국 …)
 * - 무료 사용량을 아는 API는 그 90%에서 자동으로 멈춘다: 월 한도(freeMonthly)와 하루 한도(freeDaily) 각각.
 *   관리자가 상한을 바꿀 수 있다
 * - 관리자가 언제든 수동으로 멈추고 다시 켤 수 있다 (pausable: false인 로그인·프록시 제외 — 멈추면 앱 자체가 안 됨)
 * - 브라우저에서 바로 부르는 API(browser: true)는 routes/usage.ts로 허용 여부를 묻고 사용을 알린다
 * 무료 사용량 수치 근거·확인일: docs/code-map.md §3 "API 사용량"
 */
export type ApiId =
  | 'google_places_search'
  | 'google_places_details'
  | 'google_maps_js'
  | 'naver_maps_js'
  | 'kakao_map'
  | 'kakao_keyword'
  | 'kakao_category'
  | 'naver_search'
  | 'gemini'
  | 'workers-ai'
  | 'groq'
  | 'exim'
  | 'overpass'
  | 'open_meteo'
  | 'nager_date'
  | 'jsdelivr'
  | 'oauth_kakao'
  | 'oauth_naver'
  | 'oauth_google'
  | 'cf_functions';

type Tz = 'UTC' | 'America/Los_Angeles' | 'Asia/Seoul';

export interface ApiDef {
  id: ApiId;
  /** paid = 결제 수단이 연결돼 무료 사용량을 넘으면 요금이 나갈 수 있음 / free = 넘으면 막힐 뿐 (나중에 유료로 바뀔 수 있음) */
  group: 'paid' | 'free';
  /** 무료 월 사용량 (호출 수) */
  freeMonthly?: number;
  /** 무료 하루 사용량 (호출 수, 공식 수치가 토큰 단위면 이 앱 기준으로 환산한 보수적 값) */
  freeDaily?: number;
  /** 무료량이 다시 채워지는 시간대 */
  tz: Tz;
  /** false = 수동 중지 불가 (로그인·홈 서버 프록시) */
  pausable?: false;
  /** 브라우저에서 바로 부름 */
  browser?: true;
  /** 월 무료량을 함께 쓰는 묶음 (예: 카카오맵 API 전체 합산). 부를 때 묶음도 세고, 묶음이 멈추면 같이 멈춘다 */
  pool?: ApiId;
  /** 묶음 전용 항목 (직접 부르지 않음 — 관리자 화면에서 합산·중지) */
  poolOnly?: true;
}

export const APIS: readonly ApiDef[] = [
  // ── 과금 가능 ──
  // Google Maps Platform (결제 계정 연결됨) — 2025-03부터 SKU별 월 무료: Essentials 1만·Pro 5천·Enterprise 1천.
  // 검색 = Text Search Pro(이름·주소·좌표·지도 링크), 상세 = Place Details Enterprise(평점·영업시간), 지도 = Dynamic Maps(Essentials)
  { id: 'google_places_search', group: 'paid', freeMonthly: 5000, tz: 'America/Los_Angeles' },
  { id: 'google_places_details', group: 'paid', freeMonthly: 1000, tz: 'America/Los_Angeles' },
  {
    id: 'google_maps_js',
    group: 'paid',
    freeMonthly: 10000,
    tz: 'America/Los_Angeles',
    browser: true,
  },
  // 네이버 지도 (NCP Maps Web Dynamic Map): 대표 계정만 무료 이용량, 넘으면 과금.
  // 콘솔 확인(2026-10-24, 대표 계정): 하루·월 모두 600만 회
  {
    id: 'naver_maps_js',
    group: 'paid',
    freeMonthly: 6_000_000,
    freeDaily: 6_000_000,
    tz: 'Asia/Seoul',
    browser: true,
  },
  // 카카오맵 REST API (developers.kakao.com 쿼터 문서, 2026-10-24 확인): API마다 하루 무료 쿼터, 넘으면 건당 요금.
  // 모든 카카오맵 API 합산 월 300만 건 무료. 무료 쿼터는 개발자 계정에서 처음 활성화한 앱에만 (이 앱 = 제공받음)
  { id: 'kakao_map', group: 'paid', freeMonthly: 3_000_000, tz: 'Asia/Seoul', poolOnly: true },
  // 키워드로 장소 검색 (장소 검색·AI 추천): 하루 10만, 넘으면 2원/건
  { id: 'kakao_keyword', group: 'paid', freeDaily: 100000, tz: 'Asia/Seoul', pool: 'kakao_map' },
  // 카테고리로 장소 검색 (가까운 지하철역): 하루 10만, 넘으면 2원/건
  { id: 'kakao_category', group: 'paid', freeDaily: 100000, tz: 'Asia/Seoul', pool: 'kakao_map' },
  // NAVER API HUB 검색: 지금은 한시적 무료(월 77.5만 회, 넘으면 차단), 유료 전환은 사전 공지 예정 → 미리 관리.
  // 하루 한도는 옛 개발자센터 기준(2.5만)으로 보수적으로
  { id: 'naver_search', group: 'paid', freeMonthly: 775000, freeDaily: 25000, tz: 'Asia/Seoul' },
  // ── 무료 (결제 수단 없음 → 넘으면 거절될 뿐) ──
  // Gemini 무료 등급(결제 없는 프로젝트): Flash-Lite 하루 500~1,000회, 태평양 자정에 초기화
  { id: 'gemini', group: 'free', freeDaily: 500, tz: 'America/Los_Angeles' },
  // Workers AI 무료 플랜: 하루 1만 Neurons(UTC 자정) ≈ 이 앱 분석 약 50회. 유료 플랜으로 올리면 과금되므로 하루 상한 유지
  { id: 'workers-ai', group: 'free', freeDaily: 50, tz: 'UTC' },
  // Groq 무료: 하루 1,000회 (조직 단위)
  { id: 'groq', group: 'free', freeDaily: 1000, tz: 'UTC' },
  // 한국수출입은행 환율: 하루 1,000회
  { id: 'exim', group: 'free', freeDaily: 1000, tz: 'Asia/Seoul' },
  // OpenStreetMap Overpass: 공용 서버 정책 "하루 1만 회 미만, 꾸준히 쓰면 그 1/100" → 100
  { id: 'overpass', group: 'free', freeDaily: 100, tz: 'UTC' },
  // 브라우저: Open-Meteo 날씨(비상업 무료, IP당 하루 1만), Nager.Date 공휴일(제한 없음), jsDelivr(대만 공휴일·환율 보조)
  { id: 'open_meteo', group: 'free', freeDaily: 10000, tz: 'UTC', browser: true },
  { id: 'nager_date', group: 'free', tz: 'UTC', browser: true },
  { id: 'jsdelivr', group: 'free', tz: 'UTC', browser: true },
  // 로그인(토큰 교환·프로필) — 무료, 멈추면 로그인 불가라 기록만
  { id: 'oauth_kakao', group: 'free', tz: 'Asia/Seoul', pausable: false },
  { id: 'oauth_naver', group: 'free', tz: 'Asia/Seoul', pausable: false },
  { id: 'oauth_google', group: 'free', tz: 'UTC', pausable: false },
  // Cloudflare Pages Functions (무료 플랜 하루 10만 요청, 넘으면 오류 — 과금 없음). 홈 서버까지 온 요청만 센다(화면 이동 제외)
  { id: 'cf_functions', group: 'free', freeDaily: 100000, tz: 'UTC', pausable: false },
];

const AUTO_RATIO = 0.9;
const def = (id: ApiId) => APIS.find((a) => a.id === id)!;
/** 그 API 시간대의 오늘 날짜 YYYY-MM-DD */
const dayIn = (tz: Tz, now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
const day = (id: ApiId) => dayIn(def(id).tz);
const month = (id: ApiId) => day(id).slice(0, 7);

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
  /** 이번 달 자동 중지 상한 */
  autoLimit: number | null;
  /** 오늘 자동 중지 상한 */
  dailyLimit: number | null;
}
function control(id: ApiId): Control {
  const row = db!
    .prepare('SELECT paused, auto_limit, auto_daily_limit FROM api_controls WHERE api = ?')
    .get(id) as
    { paused: number; auto_limit: number | null; auto_daily_limit: number | null } | undefined;
  const d = def(id);
  const ratio = (n?: number) => (n ? Math.floor(n * AUTO_RATIO) : null);
  return {
    paused: d.pausable !== false && !!row?.paused,
    autoLimit: row?.auto_limit ?? ratio(d.freeMonthly),
    dailyLimit: row?.auto_daily_limit ?? ratio(d.freeDaily),
  };
}

function monthCount(id: ApiId): number {
  return (
    (
      db!
        .prepare('SELECT SUM(count) AS n FROM api_usage WHERE api = ? AND date LIKE ?')
        .get(id, `${month(id)}-%`) as { n: number | null }
    ).n ?? 0
  );
}

function todayCount(id: ApiId): number {
  return (
    (
      db!.prepare('SELECT count FROM api_usage WHERE api = ? AND date = ?').get(id, day(id)) as
        { count: number } | undefined
    )?.count ?? 0
  );
}

/** 어느 상한에 닿았나 (없으면 null) */
function autoStop(id: ApiId, c: Control): 'month' | 'day' | null {
  if (c.autoLimit !== null && monthCount(id) >= c.autoLimit) return 'month';
  if (c.dailyLimit !== null && todayCount(id) >= c.dailyLimit) return 'day';
  return null;
}

/** 지금 불러도 되나: 수동 중지 아님 + 이번 달·오늘 자동 상한 전 */
export function apiAllowed(id: ApiId): boolean {
  if (!db) return true;
  const c = control(id);
  if (c.paused || autoStop(id, c) !== null) return false;
  const pool = def(id).pool;
  return pool ? apiAllowed(pool) : true;
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
  ).run(id, day(id), n);
  const pool = def(id).pool;
  if (pool) trackApi(pool, n);
}

export function setApiPaused(id: ApiId, paused: boolean): void {
  db!
    .prepare(
      `INSERT INTO api_controls (api, paused) VALUES (?, ?)
       ON CONFLICT (api) DO UPDATE SET paused = excluded.paused`,
    )
    .run(id, paused ? 1 : 0);
}

/** 자동 중지 상한. kind = month(이번 달 호출 수) / day(오늘). null = 기본값(무료 사용량의 90%) */
export function setApiLimit(
  id: ApiId,
  limit: number | null,
  kind: 'month' | 'day' = 'month',
): void {
  const col = kind === 'month' ? 'auto_limit' : 'auto_daily_limit';
  db!
    .prepare(
      `INSERT INTO api_controls (api, ${col}) VALUES (?, ?)
       ON CONFLICT (api) DO UPDATE SET ${col} = excluded.${col}`,
    )
    .run(id, limit);
}

export const isApiId = (v: string): v is ApiId => APIS.some((a) => a.id === v);
export const isPausable = (id: ApiId) => def(id).pausable !== false;
export const isBrowserApi = (v: unknown): v is ApiId =>
  typeof v === 'string' && APIS.some((a) => a.id === v && a.browser);

/** 관리자 화면용: 이번 달 누적·오늘·하루별, 상태 */
export function usageReport() {
  return {
    month: dayIn('Asia/Seoul').slice(0, 7),
    apis: APIS.map((a) => {
      const c = control(a.id);
      const daily = db!
        .prepare('SELECT date, count FROM api_usage WHERE api = ? AND date LIKE ? ORDER BY date')
        .all(a.id, `${month(a.id)}-%`) as { date: string; count: number }[];
      const stop = c.paused ? null : autoStop(a.id, c);
      return {
        id: a.id,
        group: a.group,
        freeMonthly: a.freeMonthly ?? null,
        freeDaily: a.freeDaily ?? null,
        autoLimit: c.autoLimit,
        dailyLimit: c.dailyLimit,
        used: monthCount(a.id),
        today: todayCount(a.id),
        daily,
        paused: c.paused,
        pausable: a.pausable !== false,
        browser: a.browser === true,
        pool: a.pool ?? null,
        poolOnly: a.poolOnly === true,
        autoStopped: stop !== null,
        autoStoppedBy: stop,
      };
    }),
  };
}
