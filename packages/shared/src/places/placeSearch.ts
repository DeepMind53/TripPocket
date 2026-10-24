/**
 * 장소 검색 결과 공통 형식 (docs/10 §3.1) — 카카오·네이버·Google 응답을 서버에서 이 모양으로 바꾼다.
 * 평점·리뷰·영업시간은 여기 넣지 않는다 (저장 금지, 상세를 볼 때만 따로 받음 — docs/10 §2.1)
 */
export type PlaceSource = 'kakao' | 'naver' | 'google';

export interface PlaceSummary {
  source: PlaceSource;
  /** 제공자 장소 id (google = place id, 영구 저장 허용) */
  id: string;
  name: string;
  address: string;
  coords: { lat: number; lng: number } | null;
  category?: string | undefined;
  /** 제공자 지도에서 보기 */
  url?: string | undefined;
  /** 전화 (카카오·네이버 검색 결과에 있을 때만 — Google은 상세 요금 등급이 올라가 받지 않음) */
  phone?: string | undefined;
}

export interface PlaceDetails {
  rating?: number | undefined;
  userRatingCount?: number | undefined;
  /** 요일별 영업시간 문장 (월요일부터) */
  weekdayText?: string[] | undefined;
  openNow?: boolean | undefined;
  /** 요일(0=일)별 열고 닫는 시각 "HH:mm" — 입력한 시간이 영업시간 밖인지 경고용 */
  periods?: { day: number; open: string; close: string }[] | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  googleMapsUrl?: string | undefined;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()·\-_,.]/g, '');

/** 검색어와 얼마나 비슷한가 (같음 > 앞부분 > 포함 > 나머지) */
export function similarity(query: string, name: string): number {
  const q = norm(query);
  const n = norm(name);
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  // 글자가 많이 겹치면 조금
  const common = [...new Set(q)].filter((c) => n.includes(c)).length;
  return Math.round((common / new Set(q).size) * 40);
}

/** 비슷한 순으로, 같은 곳(이름이 같고 200m 안)은 하나로 — 먼저 온 출처 우선 */
export function rankPlaces(
  query: string,
  list: readonly PlaceSummary[],
  limit = 8,
): PlaceSummary[] {
  const near = (a: PlaceSummary, b: PlaceSummary) =>
    !!a.coords &&
    !!b.coords &&
    Math.abs(a.coords.lat - b.coords.lat) < 0.002 &&
    Math.abs(a.coords.lng - b.coords.lng) < 0.0025;
  const out: PlaceSummary[] = [];
  for (const p of list)
    if (!out.some((o) => norm(o.name) === norm(p.name) && (near(o, p) || !o.coords || !p.coords)))
      out.push(p);
  return out
    .map((p, i) => ({ p, i, s: similarity(query, p.name) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/**
 * 입력한 시간이 영업시간 밖인가 (요일 0=일). periods가 없으면 모름(null)
 */
export function isOutsideHours(
  periods: PlaceDetails['periods'],
  weekday: number,
  time: string,
): boolean | null {
  if (!periods || periods.length === 0) return null;
  const today = periods.filter((p) => p.day === weekday);
  if (today.length === 0) return true; // 그날 휴무
  return !today.some((p) =>
    p.close <= p.open ? time >= p.open || time < p.close : time >= p.open && time < p.close,
  );
}
