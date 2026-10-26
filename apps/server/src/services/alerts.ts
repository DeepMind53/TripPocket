import type { AlertKind, AlertSource, DestinationAlert } from '@trippocket/shared';
import { MOFA_SAFETY_URL } from '@trippocket/shared';
import { guardApi, trackApi, type ApiId } from './apiUsage';

/**
 * 여행지 기상·재난 특보 (docs/24 §1, ADR-0008) — 전 세계 공통 출처 3곳.
 * - GDACS(UN·EU): 태풍·지진·홍수·화산·산불·가뭄 주황·빨강 경보, 피해 나라 ISO 코드
 * - USGS: 규모 5.5 이상, 최근 72시간 지진. 나라는 위치 설명("…, Japan")의 끝에서 읽는다
 * - 외교부(공공데이터포털): 여행경보 단계 + 특별여행주의보·특별여행경보 지역
 *   (특별여행주의보 API의 evacuate_* = 특별여행주의보, forbidden_* = 특별여행경보 — 2026-10-27 실제 응답: 중국 티베트·신장 = evacuate)
 * 사용자 수와 상관없이 출처마다 정해진 간격으로 한 번만 받아 메모리에 둔다 (GDACS·USGS 10분, 외교부 3시간).
 * 위치(좌표)는 받지도 보내지도 않는다 — 나라 코드로만 고른다
 */

const MIN = 60_000;
const TTL: Record<AlertSource, number> = { gdacs: 10 * MIN, usgs: 10 * MIN, mofa: 180 * MIN };
const API: Record<AlertSource, ApiId> = { gdacs: 'gdacs', usgs: 'usgs', mofa: 'mofa_alert' };

interface Cached {
  at: number;
  alerts: DestinationAlert[];
}
const cache = new Map<AlertSource, Cached>();
/** 같은 출처를 동시에 여러 번 받지 않게 */
const inflight = new Map<AlertSource, Promise<DestinationAlert[]>>();

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

async function getJson(source: AlertSource, url: string): Promise<unknown> {
  guardApi(API[source]);
  trackApi(API[source]);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'TripPocket (https://trippocket.day)' },
  });
  if (!res.ok) throw new Error(`${source} ${res.status}`);
  return res.json();
}

// ── GDACS ──
const GDACS_KIND: Record<string, AlertKind> = {
  TC: 'cyclone',
  EQ: 'earthquake',
  FL: 'flood',
  VO: 'volcano',
  WF: 'wildfire',
  // DR(가뭄)은 몇 달씩 이어지고 여행과 관계없어 뺀다
};

interface GdacsProps {
  eventtype?: string;
  eventid?: number;
  name?: string;
  alertlevel?: string;
  iscurrent?: string;
  fromdate?: string;
  todate?: string;
  url?: { report?: string };
  affectedcountries?: { iso2?: string }[];
}

export function parseGdacs(raw: unknown, now = Date.now()): DestinationAlert[] {
  const features = (raw as { features?: { properties?: GdacsProps }[] }).features ?? [];
  const out: DestinationAlert[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const kind = GDACS_KIND[p.eventtype ?? ''];
    const level = p.alertlevel === 'Red' ? 'red' : p.alertlevel === 'Orange' ? 'orange' : null;
    if (!kind || !level || p.eventid === undefined) continue;
    // 끝난 지 3일 넘은 사건은 뺀다 (GDACS 시각은 UTC, Z 없이 온다)
    const until = p.todate ? Date.parse(`${p.todate}Z`) : NaN;
    if (p.iscurrent !== 'true' && !(until > now - 3 * 1440 * MIN)) continue;
    for (const c of p.affectedcountries ?? []) {
      if (!c.iso2) continue;
      out.push({
        id: `gdacs-${p.eventtype}-${p.eventid}-${c.iso2}`,
        country: c.iso2.toUpperCase(),
        kind,
        level,
        title: p.name ?? `${p.eventtype} ${p.eventid}`,
        from: p.fromdate ? `${p.fromdate}Z` : undefined,
        until: p.todate ? `${p.todate}Z` : undefined,
        source: 'gdacs',
        url: p.url?.report ?? 'https://www.gdacs.org/',
      });
    }
  }
  return out;
}

async function fetchGdacs(): Promise<DestinationAlert[]> {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const now = Date.now();
  const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=Orange;Red&fromdate=${day(now - 30 * 1440 * MIN)}&todate=${day(now)}`;
  return parseGdacs(await getJson('gdacs', url), now);
}

// ── USGS ──
const US_STATES =
  'Alabama Alaska Arizona Arkansas California Colorado Connecticut Delaware Florida Georgia Hawaii Idaho Illinois Indiana Iowa Kansas Kentucky Louisiana Maine Maryland Massachusetts Michigan Minnesota Mississippi Missouri Montana Nebraska Nevada Ohio Oklahoma Oregon Pennsylvania Tennessee Texas Utah Vermont Virginia Washington Wisconsin Wyoming'.split(
    ' ',
  );
const US_MULTI = [
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'West Virginia',
];
/** USGS 표기가 영어 나라 이름과 다른 것 */
const NAME_ALIAS: Record<string, string> = {
  turkey: 'TR',
  burma: 'MM',
  myanmar: 'MM',
  russia: 'RU',
  'south korea': 'KR',
  'north korea': 'KP',
  'fiji islands': 'FJ',
  'kuril islands': 'RU',
  'bonin islands': 'JP',
  'ryukyu islands': 'JP',
  'izu islands': 'JP',
  'mariana islands': 'MP',
  'northern mariana islands': 'MP',
  'taiwan region': 'TW',
};

/** 옛 코드·나라가 아닌 묶음 — Intl은 이름을 주지만 쓰면 안 된다 (SU = 소련 → Russia 등) */
const RETIRED = new Set('AN BU CS DD EU EZ FX NT QO SU TP UN XA XB YU ZR ZZ'.split(' '));

let names: [string, string][] | null = null;
/** 영어 나라 이름 → ISO (긴 이름부터, Intl로 만든다 — 목록을 따로 들고 있지 않음) */
function countryNames(): [string, string][] {
  if (names) return names;
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  const map = new Map<string, string>(Object.entries(NAME_ALIAS));
  for (let a = 65; a <= 90; a++)
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      let name: string | undefined;
      try {
        name = dn.of(code);
      } catch {
        name = undefined;
      }
      if (name && name !== code && !RETIRED.has(code) && !map.has(name.toLowerCase()))
        map.set(name.toLowerCase(), code);
    }
  for (const s of [...US_STATES, ...US_MULTI]) map.set(s.toLowerCase(), 'US');
  names = [...map.entries()].sort((x, y) => y[0].length - x[0].length);
  return names;
}

/** "45 km E of Hualien City, Taiwan" → TW, "south of the Fiji Islands" → FJ, "…, CA" → US */
export function usgsCountry(place: string): string | undefined {
  const tail = (place.includes(',') ? place.slice(place.lastIndexOf(',') + 1) : place)
    .trim()
    .replace(/\s+region$/i, '');
  if (/^[A-Z]{2}$/.test(tail)) return 'US';
  const low = tail.toLowerCase();
  for (const [name, code] of countryNames()) {
    if (low === name) return code;
  }
  for (const [name, code] of countryNames()) {
    if (
      name.length >= 4 &&
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(low)
    )
      return code;
  }
  return undefined;
}

interface UsgsFeature {
  id?: string;
  properties?: { mag?: number; place?: string; time?: number; url?: string; alert?: string | null };
}

export function parseUsgs(raw: unknown, now = Date.now()): DestinationAlert[] {
  const features = (raw as { features?: UsgsFeature[] }).features ?? [];
  const out: DestinationAlert[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    if (!f.id || p.mag === undefined || p.mag < 5.5 || !p.place || !p.time) continue;
    if (p.time < now - 72 * 60 * MIN) continue;
    const country = usgsCountry(p.place);
    if (!country) continue;
    const level =
      p.alert === 'red' || p.alert === 'orange' || p.mag >= 7
        ? 'red'
        : p.mag >= 6 || p.alert === 'yellow'
          ? 'orange'
          : 'info';
    out.push({
      id: `usgs-${f.id}`,
      country,
      kind: 'earthquake',
      level,
      title: `M ${p.mag.toFixed(1)} - ${p.place}`,
      magnitude: p.mag,
      from: new Date(p.time).toISOString(),
      source: 'usgs',
      url: p.url ?? 'https://earthquake.usgs.gov/',
    });
  }
  return out;
}

const fetchUsgs = async () =>
  parseUsgs(
    await getJson(
      'usgs',
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson',
    ),
  );

// ── 외교부 ──
interface MofaItem {
  country_iso_alp2?: string;
  country_nm?: string;
  alarm_lvl?: string;
  region_ty?: string;
  remark?: string | null;
  evacuate_rcmnd_remark?: string | null;
  evacuate_region_ty?: string | null;
  forbidden_rcmnd_remark?: string | null;
  forbidden_region_ty?: string | null;
}
const items = (raw: unknown): MofaItem[] => {
  const item = (raw as { response?: { body?: { items?: { item?: MofaItem[] | MofaItem } } } })
    .response?.body?.items?.item;
  return Array.isArray(item) ? item : item ? [item] : [];
};

export function parseMofa(alarm: unknown, special: unknown): DestinationAlert[] {
  const out: DestinationAlert[] = [];
  for (const i of items(alarm)) {
    const step = Number(i.alarm_lvl);
    const country = str(i.country_iso_alp2)?.toUpperCase();
    if (!country || !(step >= 1 && step <= 4)) continue;
    out.push({
      id: `mofa-${country}-${step}`,
      country,
      kind: 'travel',
      level: step >= 3 ? 'red' : step === 2 ? 'orange' : 'info',
      title: i.country_nm ?? country,
      step,
      area: str(i.remark),
      whole: i.region_ty === '전체',
      source: 'mofa',
      url: MOFA_SAFETY_URL,
    });
  }
  for (const i of items(special)) {
    const country = str(i.country_iso_alp2)?.toUpperCase();
    if (!country) continue;
    const add = (special: 'evacuate' | 'forbidden', remark: unknown, region: unknown) => {
      if (!str(remark) && !str(region)) return;
      out.push({
        id: `mofa-${country}-${special}`,
        country,
        kind: 'travel',
        level: 'red',
        title: i.country_nm ?? country,
        special,
        area: str(remark),
        whole: region === '전체',
        source: 'mofa',
        url: MOFA_SAFETY_URL,
      });
    };
    add('evacuate', i.evacuate_rcmnd_remark, i.evacuate_region_ty);
    add('forbidden', i.forbidden_rcmnd_remark, i.forbidden_region_ty);
  }
  return out;
}

async function fetchMofa(key: string): Promise<DestinationAlert[]> {
  const base = 'https://apis.data.go.kr/1262000';
  const q = `serviceKey=${encodeURIComponent(key)}&returnType=JSON&numOfRows=1000&pageNo=1`;
  const [alarm, special] = await Promise.all([
    getJson('mofa', `${base}/TravelAlarmService2/getTravelAlarmList2?${q}`),
    getJson('mofa', `${base}/SptravelWarningServiceV2/getSptravelWarningListV2?${q}`),
  ]);
  return parseMofa(alarm, special);
}

// ── 묶기 ──
async function load(
  source: AlertSource,
  get: () => Promise<DestinationAlert[]>,
): Promise<DestinationAlert[] | null> {
  const hit = cache.get(source);
  if (hit && Date.now() - hit.at < TTL[source]) return hit.alerts;
  let p = inflight.get(source);
  if (!p) {
    p = get();
    inflight.set(source, p);
  }
  try {
    const alerts = await p;
    cache.set(source, { at: Date.now(), alerts });
    return alerts;
  } catch {
    // 못 받으면 지난 결과라도 (최대 하루), 없으면 빠진 출처로
    return hit && Date.now() - hit.at < 1440 * MIN ? hit.alerts : null;
  } finally {
    inflight.delete(source);
  }
}

export async function alertsFor(
  countries: readonly string[],
  mofaKey: string | undefined,
): Promise<{ alerts: DestinationAlert[]; missing: AlertSource[]; checkedAt: string }> {
  const sources: [AlertSource, (() => Promise<DestinationAlert[]>) | null][] = [
    ['gdacs', fetchGdacs],
    ['usgs', fetchUsgs],
    ['mofa', mofaKey ? () => fetchMofa(mofaKey) : null],
  ];
  const results = await Promise.all(
    sources.map(async ([s, get]) => [s, get ? await load(s, get) : null] as const),
  );
  const want = new Set(countries);
  const order = { red: 0, orange: 1, info: 2 } as const;
  const alerts = results
    .flatMap(([, a]) => a ?? [])
    .filter((a) => want.has(a.country))
    .sort((a, b) => order[a.level] - order[b.level]);
  const times = sources.map(([s]) => cache.get(s)?.at).filter((t): t is number => !!t);
  return {
    alerts,
    missing: results.filter(([, a]) => a === null).map(([s]) => s),
    checkedAt: new Date(times.length ? Math.min(...times) : Date.now()).toISOString(),
  };
}

/** 테스트용 */
export function resetAlertCache(): void {
  cache.clear();
  inflight.clear();
}
