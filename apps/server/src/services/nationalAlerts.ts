import type { AlertLevel, DestinationAlert } from '@trippocket/shared';
import { WEATHER_WARNING_LINKS } from '@trippocket/shared';
import { guardApi, trackApi, type ApiId } from './apiUsage';

/**
 * 나라 기상청 특보 (docs/24 §7, ADR-0008 2단계) — 공식 발표를 그대로 옮긴다(자체 판단 문구 없음).
 * - 한국 기상청(공공데이터포털 getPwnStatus): 지금 발효 중인 특보 전국 현황 → 특보 종류마다 하나
 * - 대만 중앙기상서(W-C0033-001): 현·시별 특보 → 같은 특보끼리 묶어 지역 목록
 * - 미국 기상청(api.weather.gov): 목적지 좌표 지점 경보 (괌·사이판은 지역 코드로)
 * - 캐나다 환경부(api.weather.gc.ca, Open Government Licence – Canada): 목적지 주변 경보
 * - 일본 기상청(bosai r8, 2026-05 새 체계): 목적지에서 가까운 대표 관측소의 1차 세분 구역 경보·주의보
 *   새 체계 코드표가 공개되지 않아 아는 코드만 이름을 붙이고, 발표 요약(headline) 원문을 함께 보여 준다
 * 목적지 좌표는 도시 좌표를 약 10km로 줄인 것 — 사용자 현재 위치가 아니며 저장하지 않는다
 */

const MIN = 60_000;
const UA = { 'user-agent': 'TripPocket (https://trippocket.day)' };

interface Entry<T> {
  at: number;
  value: T;
}
const cache = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 300;

/** 같은 키는 ttl 동안 다시 부르지 않는다. 실패하면 하루 안의 지난 값, 없으면 throw */
async function cached<T>(key: string, ttl: number, get: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  try {
    const value = await get();
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit && Date.now() - hit.at < 1440 * MIN) return hit.value;
    throw e;
  }
}

async function getJson(api: ApiId, url: string, headers: Record<string, string> = UA) {
  guardApi(api);
  trackApi(api);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers });
  if (!res.ok) throw new Error(`${api} ${res.status}`);
  return (await res.json()) as unknown;
}

const link = (c: string) => WEATHER_WARNING_LINKS[c]?.url ?? 'https://severeweather.wmo.int/';

/** 공공데이터포털 결과 코드: 00(외교부는 0) 정상, 03 자료 없음. 그 밖(30 키 미등록, 31 활용기간 만료, 22 한도 …)은 실패로 */
export function dataGoKrOk(code: string | undefined): void {
  if (code !== undefined && !['0', '00', '03'].includes(code))
    throw new Error(`data.go.kr ${code}`);
}

// ── 한국 기상청 ──
/** "o 강풍주의보 : 서해5도, 인천(옹진)" 줄마다 하나 */
export function parseKma(raw: unknown): DestinationAlert[] {
  const res = (
    raw as {
      response?: {
        header?: { resultCode?: string };
        body?: { items?: { item?: { t6?: string }[] } };
      };
    }
  ).response;
  dataGoKrOk(res?.header?.resultCode);
  const body = res?.body;
  const t6 = body?.items?.item?.[0]?.t6 ?? '';
  const out: DestinationAlert[] = [];
  for (const line of t6.split(/\r?\n/)) {
    const m = /^o\s*([^:]+?)\s*:\s*(.+)$/.exec(line.trim());
    if (!m) continue;
    const name = m[1]!.trim();
    if (name === '없음') continue;
    out.push({
      id: `kma-${name}`,
      country: 'KR',
      kind: 'weather',
      level: name.endsWith('경보') ? (/태풍|호우|대설/.test(name) ? 'red' : 'orange') : 'info',
      title: name,
      names: [name],
      area: m[2]!.trim(),
      source: 'kma',
      url: link('KR'),
    });
  }
  return out;
}

const fetchKma = (key: string) =>
  cached('kma', 10 * MIN, async () =>
    parseKma(
      await getJson(
        'kma_warning',
        `https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus?serviceKey=${encodeURIComponent(key)}&dataType=JSON&numOfRows=10&pageNo=1`,
      ),
    ),
  );

// ── 대만 중앙기상서 ──
interface CwaLocation {
  locationName?: string;
  hazardConditions?: {
    hazards?: {
      info?: { phenomena?: string; significance?: string };
      validTime?: { startTime?: string; endTime?: string };
    }[];
  };
}

export function parseCwa(raw: unknown): DestinationAlert[] {
  const locs = (raw as { records?: { location?: CwaLocation[] } }).records?.location ?? [];
  const byName = new Map<string, { areas: string[]; until?: string | undefined }>();
  for (const l of locs) {
    for (const h of l.hazardConditions?.hazards ?? []) {
      const name = `${h.info?.phenomena ?? ''}${h.info?.significance ?? ''}`;
      if (!name || !l.locationName) continue;
      const g = byName.get(name) ?? { areas: [], until: h.validTime?.endTime };
      g.areas.push(l.locationName);
      byName.set(name, g);
    }
  }
  return [...byName].map(([name, g]) => ({
    id: `cwa-${name}`,
    country: 'TW',
    kind: 'weather',
    level: /颱風/.test(name) ? 'orange' : 'info',
    title: name,
    names: [name],
    area: g.areas.join(', '),
    // CWA 시각은 대만 시간(+08:00)
    until: g.until ? `${g.until.replace(' ', 'T')}+08:00` : undefined,
    source: 'cwa',
    url: link('TW'),
  }));
}

const fetchCwa = (key: string) =>
  cached('cwa', 10 * MIN, async () =>
    parseCwa(
      await getJson(
        'cwa',
        `https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0033-001?Authorization=${encodeURIComponent(key)}&format=JSON`,
      ),
    ),
  );

// ── 미국 기상청 ──
interface NwsFeature {
  id?: string;
  properties?: {
    event?: string;
    severity?: string;
    headline?: string;
    areaDesc?: string;
    effective?: string;
    expires?: string;
  };
}

export function parseNws(raw: unknown, country: string): DestinationAlert[] {
  const features = (raw as { features?: NwsFeature[] }).features ?? [];
  return features.flatMap((f): DestinationAlert[] => {
    const p = f.properties ?? {};
    if (!p.event) return [];
    const level: AlertLevel =
      p.severity === 'Extreme' ? 'red' : p.severity === 'Severe' ? 'orange' : 'info';
    return [
      {
        // feature id는 갱신마다 바뀐다 → 종류·지역으로 (같은 경보가 이어지면 같은 id)
        id: `nws-${country}-${p.event}-${p.areaDesc ?? ''}`,
        country,
        kind: 'weather',
        level,
        title: p.headline ?? p.event,
        names: [p.event],
        area: p.areaDesc,
        from: p.effective,
        until: p.expires,
        source: 'nws',
        url: link(country),
      },
    ];
  });
}

/** 괌·사이판은 지역 코드, 미국 본토·하와이 등은 목적지 지점 */
const fetchNws = (country: string, point?: [number, number]) => {
  const q =
    country === 'GU' || country === 'MP'
      ? `area=${country}`
      : point
        ? `point=${point[0]},${point[1]}`
        : null;
  if (!q) return Promise.resolve<DestinationAlert[]>([]);
  return cached(`nws-${q}`, 10 * MIN, async () =>
    parseNws(
      await getJson('nws', `https://api.weather.gov/alerts/active?${q}`, {
        ...UA,
        accept: 'application/geo+json',
      }),
      country,
    ),
  );
};

// ── 캐나다 환경부 ──
interface EcccFeature {
  properties?: {
    alert_code?: string;
    alert_name_en?: string;
    alert_short_name_en?: string;
    risk_colour_en?: string;
    feature_name_en?: string;
    feature_id?: string;
    validity_datetime?: string;
    event_end_datetime?: string;
  };
}

export function parseEccc(raw: unknown): DestinationAlert[] {
  const features = (raw as { features?: EcccFeature[] }).features ?? [];
  return features.flatMap((f): DestinationAlert[] => {
    const p = f.properties ?? {};
    if (!p.alert_code || !p.alert_name_en) return [];
    const level: AlertLevel =
      p.risk_colour_en === 'red' ? 'red' : p.risk_colour_en === 'orange' ? 'orange' : 'info';
    return [
      {
        id: `eccc-${p.alert_code}-${p.feature_id ?? ''}`,
        country: 'CA',
        kind: 'weather',
        level,
        title: p.alert_name_en,
        names: [p.alert_short_name_en ?? p.alert_name_en],
        area: p.feature_name_en,
        from: p.validity_datetime,
        until: p.event_end_datetime,
        source: 'eccc',
        url: link('CA'),
      },
    ];
  });
}

/** 목적지 좌표 주변(약 ±10km) 경보 구역 */
const fetchEccc = (point: [number, number]) => {
  const [lat, lng] = point;
  const bbox = [lng - 0.1, lat - 0.1, lng + 0.1, lat + 0.1].map((n) => n.toFixed(1)).join(',');
  return cached(`eccc-${bbox}`, 10 * MIN, async () =>
    parseEccc(
      await getJson(
        'eccc',
        `https://api.weather.gc.ca/collections/weather-alerts/items?f=json&lang=en&limit=50&bbox=${bbox}`,
      ),
    ),
  );
};

// ── 일본 기상청 ──
/** 옛 코드표 (2026-05 개편 뒤에도 바람·눈·파도 등은 그대로 쓰임). 모르는 코드는 이름을 붙이지 않는다 */
const JMA_CODE: Record<string, [string, AlertLevel]> = {
  '02': ['暴風雪警報', 'orange'],
  '03': ['大雨警報', 'orange'],
  '04': ['洪水警報', 'orange'],
  '05': ['暴風警報', 'orange'],
  '06': ['大雪警報', 'orange'],
  '07': ['波浪警報', 'orange'],
  '08': ['高潮警報', 'orange'],
  '10': ['大雨注意報', 'info'],
  '12': ['大雪注意報', 'info'],
  '13': ['風雪注意報', 'info'],
  '14': ['雷注意報', 'info'],
  '15': ['強風注意報', 'info'],
  '16': ['波浪注意報', 'info'],
  '17': ['融雪注意報', 'info'],
  '18': ['洪水注意報', 'info'],
  '19': ['高潮注意報', 'info'],
  '20': ['濃霧注意報', 'info'],
  '21': ['乾燥注意報', 'info'],
  '22': ['なだれ注意報', 'info'],
  '23': ['低温注意報', 'info'],
  '24': ['霜注意報', 'info'],
  '25': ['着氷注意報', 'info'],
  '26': ['着雪注意報', 'info'],
  '32': ['暴風雪特別警報', 'red'],
  '33': ['大雨特別警報', 'red'],
  '35': ['暴風特別警報', 'red'],
  '36': ['大雪特別警報', 'red'],
  '37': ['波浪特別警報', 'red'],
  '38': ['高潮特別警報', 'red'],
};

const JMA = 'https://www.jma.go.jp/bosai';
const deg = (v: unknown) => (Array.isArray(v) ? Number(v[0]) + Number(v[1]) / 60 : Number(v));

/** 대표 관측소(예보 구역마다 하나) 좌표 → 1차 세분 구역(class10) 코드 */
type Stations = { lat: number; lng: number; class10: string }[];

export function jmaStations(forecastArea: unknown, amedas: unknown): Stations {
  const fa = forecastArea as Record<string, { class10?: string; amedas?: string[] }[]>;
  const am = amedas as Record<string, { lat?: unknown; lon?: unknown }>;
  const out: Stations = [];
  for (const list of Object.values(fa))
    for (const a of list) {
      const s = a.amedas?.[0] ? am[a.amedas[0]] : undefined;
      if (a.class10 && s) out.push({ lat: deg(s.lat), lng: deg(s.lon), class10: a.class10 });
    }
  return out;
}

const loadStations = () =>
  cached('jma-stations', 1440 * MIN, async () =>
    jmaStations(
      await getJson('jma', `${JMA}/forecast/const/forecast_area.json`),
      await getJson('jma', `${JMA}/amedas/const/amedastable.json`),
    ),
  );

interface JmaReport {
  reportDatetime?: string;
  headlineText?: string;
  warning?: {
    class10Items?: { areaCode?: string; kinds?: { code?: string; status?: string }[] }[];
  };
}

/** 그 구역의 가장 최근 발표에서 발표·계속 중인 경보·주의보 */
export function parseJma(map: unknown, class10: string): DestinationAlert[] {
  const reports = (Array.isArray(map) ? map : []) as JmaReport[];
  let latest: { r: JmaReport; codes: string[] } | null = null;
  for (const r of reports) {
    const item = r.warning?.class10Items?.find((i) => i.areaCode === class10);
    if (!item) continue;
    if (latest && (latest.r.reportDatetime ?? '') >= (r.reportDatetime ?? '')) continue;
    const codes = (item.kinds ?? [])
      .filter((k) => k.code && (k.status === '発表' || k.status === '継続'))
      .map((k) => k.code!);
    latest = { r, codes };
  }
  if (!latest || latest.codes.length === 0) return [];
  const known = latest.codes.map((c) => JMA_CODE[c]).filter((k) => k !== undefined);
  const rank = { red: 0, orange: 1, info: 2 } as const;
  const level = known.reduce<AlertLevel>((lv, [, l]) => (rank[l] < rank[lv] ? l : lv), 'info');
  return [
    {
      // 재발표마다 바뀌는 시각 대신 구역·종류로 (같은 경보가 이어지면 같은 id)
      id: `jma-${class10}-${[...latest.codes].sort().join('.')}`,
      country: 'JP',
      kind: 'weather',
      level,
      title: latest.r.headlineText?.trim() || known.map(([n]) => n).join('・'),
      names: known.map(([n]) => n),
      from: latest.r.reportDatetime,
      source: 'jma',
      url: `${JMA}/warning/#area_type=class10s&area_code=${class10}`,
    },
  ];
}

async function fetchJma(point: [number, number]): Promise<DestinationAlert[]> {
  const stations = await loadStations();
  let best: Stations[number] | undefined;
  let bestD = Infinity;
  for (const s of stations) {
    const d =
      (s.lat - point[0]) ** 2 + ((s.lng - point[1]) * Math.cos((point[0] * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  // 약 1.5도(150km) 넘게 떨어지면 일본 밖으로 본다
  if (!best || bestD > 1.5 ** 2) return [];
  const map = await cached('jma-map', 10 * MIN, () =>
    getJson('jma', `${JMA}/warning/data/r8/map.json`),
  );
  return parseJma(map, best.class10);
}

// ── 묶기 ──
export type NationalSource = 'jma' | 'kma' | 'nws' | 'cwa' | 'eccc';

export interface NationalKeys {
  dataGoKr?: string | undefined;
  cwa?: string | undefined;
}

/**
 * 나라마다 그 나라 기상청 특보. points = 나라별 목적지 좌표(약 10km로 줄인 것, 일본·미국만 씀).
 * 키가 없거나 못 받은 출처는 missing으로
 */
export async function nationalAlerts(
  countries: readonly string[],
  points: ReadonlyMap<string, [number, number][]>,
  keys: NationalKeys,
): Promise<{ alerts: DestinationAlert[]; missing: NationalSource[] }> {
  const jobs: [NationalSource, Promise<DestinationAlert[]>][] = [];
  const want = new Set(countries);
  if (want.has('KR'))
    jobs.push([
      'kma',
      keys.dataGoKr ? fetchKma(keys.dataGoKr) : Promise.reject(new Error('no key')),
    ]);
  if (want.has('TW'))
    jobs.push(['cwa', keys.cwa ? fetchCwa(keys.cwa) : Promise.reject(new Error('no key'))]);
  for (const c of ['GU', 'MP'] as const) if (want.has(c)) jobs.push(['nws', fetchNws(c)]);
  if (want.has('US'))
    for (const p of (points.get('US') ?? []).slice(0, 3)) jobs.push(['nws', fetchNws('US', p)]);
  if (want.has('CA'))
    for (const p of (points.get('CA') ?? []).slice(0, 3)) jobs.push(['eccc', fetchEccc(p)]);
  if (want.has('JP'))
    for (const p of (points.get('JP') ?? []).slice(0, 3)) jobs.push(['jma', fetchJma(p)]);

  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  const seen = new Set<string>();
  const alerts: DestinationAlert[] = [];
  const missing = new Set<NationalSource>();
  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      missing.add(jobs[i]![0]);
      return;
    }
    for (const a of r.value)
      if (!seen.has(a.id)) {
        seen.add(a.id);
        alerts.push(a);
      }
  });
  return { alerts, missing: [...missing] };
}

/** 테스트용 */
export function resetNationalCache(): void {
  cache.clear();
}
