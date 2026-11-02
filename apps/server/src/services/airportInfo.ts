import { guardApi, trackApi } from './apiUsage';

/**
 * 국내 공항의 편명별 터미널·체크인 카운터·게이트·수하물 수취대 (공공데이터포털, 무료).
 * - 인천: 인천국제공항공사 "항공기 운항 현황 상세 조회" — 조회일 기준 3일 전 ~ 6일 후만
 * - 김포·김해·제주 등 14곳: 한국공항공사 "실시간 항공기 운항정보 검색" — 오늘 운항만, 게이트까지 (체크인 카운터·터미널 없음)
 * 값은 바뀔 수 있어 저장하지 않고, 앱이 확인 시각과 함께 보여 준다 (사용자 요청 2026-11-02)
 */
export interface AirportSide {
  airport: string;
  /** "T1" · "T1 탑승동" · "T2" · 국내선/국제선 */
  terminal?: string;
  /** 체크인 카운터 ("B29-B32", "A B C D") */
  counter?: string;
  gate?: string;
  /** 도착: 수하물 수취대·출구 */
  carousel?: string;
  exit?: string;
  /** 예정·변경 시각 HH:mm */
  scheduled?: string;
  estimated?: string;
  /** 출발·지연·결항 등 */
  status?: string;
}

export const KAC_AIRPORTS = new Set([
  'GMP',
  'PUS',
  'CJU',
  'TAE',
  'CJJ',
  'KWJ',
  'RSU',
  'USN',
  'KPO',
  'WJU',
  'YNY',
  'MWX',
  'HIN',
  'KUV',
]);
/** 인천 조회 범위 (조회일 기준) */
export const ICN_DAYS_BEFORE = 3;
export const ICN_DAYS_AFTER = 6;

const ICN_TERMINAL: Record<string, string> = { P01: 'T1', P02: 'T1 탑승동', P03: 'T2' };
const hm = (v: unknown) => {
  const s = String(v ?? '');
  return /^\d{12}$/.test(s)
    ? `${s.slice(8, 10)}:${s.slice(10, 12)}`
    : /^\d{4}$/.test(s)
      ? `${s.slice(0, 2)}:${s.slice(2)}`
      : undefined;
};
const text = (v: unknown) => {
  const s = String(v ?? '').trim();
  return s && s !== 'null' ? s : undefined;
};
/** 빈 칸은 빼고 (exactOptionalPropertyTypes) */
const clean = (o: { [K in keyof AirportSide]: AirportSide[K] | undefined }): AirportSide =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as unknown as AirportSide;

/** 인천: 그날(YYYY-MM-DD) 그 편명. io = dep(인천 출발) / arr(인천 도착) */
export async function icnSide(
  key: string,
  flightNo: string,
  date: string,
  io: 'dep' | 'arr',
): Promise<AirportSide | null> {
  guardApi('icn_flights');
  trackApi('icn_flights');
  const op = io === 'dep' ? 'getFltDeparturesDeOdp' : 'getFltArrivalsDeOdp';
  const url = new URL(`https://apis.data.go.kr/B551177/statusOfAllFltDeOdp/${op}`);
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '20');
  url.searchParams.set('type', 'json');
  url.searchParams.set('searchdtCode', 'S');
  url.searchParams.set('searchDate', date.replace(/-/g, ''));
  url.searchParams.set('flightId', flightNo);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`icn ${res.status}`);
  const body = (await res.json()) as {
    response?: {
      body?: { items?: Record<string, unknown>[] | { item?: Record<string, unknown>[] } };
    };
  };
  const raw = body.response?.body?.items;
  const items = Array.isArray(raw) ? raw : (raw?.item ?? []);
  const day = date.replace(/-/g, '');
  const it = items.find((x) => String(x.scheduleDatetime ?? '').startsWith(day)) ?? items[0];
  if (!it) return null;
  return clean({
    airport: 'ICN',
    terminal: ICN_TERMINAL[String(it.terminalId)] ?? text(it.terminalId),
    counter: text(it.chkinRange),
    gate: text(it.gateNumber),
    carousel: text(it.carousel),
    exit: text(it.exitNumber),
    scheduled: hm(it.scheduleDatetime),
    estimated: hm(it.estimatedDatetime),
    status: text(it.remark),
  });
}

/** 한국공항공사 공항(김포 등): 오늘 운항 중 그 편명. io = dep(그 공항 출발) / arr(그 공항 도착) */
export async function kacSide(
  key: string,
  flightNo: string,
  airport: string,
  io: 'dep' | 'arr',
): Promise<AirportSide | null> {
  guardApi('kac_flights');
  trackApi('kac_flights');
  const url = new URL('https://apis.data.go.kr/B551178/flight-search/info');
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('schFln', flightNo);
  url.searchParams.set('schAirCode', airport);
  url.searchParams.set('schIOType', io === 'dep' ? 'O' : 'I');
  url.searchParams.set('type', 'json');
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`kac ${res.status}`);
  const body = (await res.json()) as {
    response?: {
      body?: { items?: { item?: Record<string, unknown>[] | Record<string, unknown> } };
    };
  };
  const raw = body.response?.body?.items?.item;
  const it = Array.isArray(raw) ? raw[0] : raw;
  if (!it) return null;
  return clean({
    airport,
    terminal: text(it.line) ? `${text(it.line)}선` : undefined,
    gate: text(it.gate),
    scheduled: hm(it.std),
    estimated: hm(it.etd),
    status: text(it.rmkKor),
  });
}
