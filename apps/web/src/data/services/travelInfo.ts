import type { LocalDate } from '@trippocket/shared';
import type { Holiday } from '../../domain/holidays';
import type { DayWeather } from '../../domain/weather';
import { settingsRepo } from '../repositories/settingsRepo';

/**
 * 달력에 보여줄 공휴일·날씨 (무료·키 없음, docs/08 L 그룹):
 * - 공휴일: Nager.Date (https://date.nager.at) — 대만·태국·말레이시아 등은 미지원
 * - 날씨: Open-Meteo (https://open-meteo.com, 비상업 무료) — 예보는 16일까지
 * 받은 값은 기기에 저장해 오프라인에서도 보여준다. 실패해도 앱은 그대로 동작(빈 값).
 * 보내는 정보: 나라 코드·연도, 목적지 도시 좌표뿐 (사용자 위치·개인정보 없음)
 */

const DAY = 86_400_000;
const HOLIDAY_TTL = 30 * DAY;
const WEATHER_TTL = 3 * 3_600_000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

interface Cached<T> {
  fetchedAt: number;
  value: T;
}

async function cached<T>(
  key: string,
  ttl: number,
  load: () => Promise<T>,
  fallback: T,
): Promise<T> {
  const hit = await settingsRepo.get<Cached<T> | null>(key, null);
  if (hit && Date.now() - hit.fetchedAt < ttl) return hit.value;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return hit?.value ?? fallback;
  try {
    const value = await load();
    await settingsRepo.set(key, { fetchedAt: Date.now(), value } satisfies Cached<T>);
    return value;
  } catch {
    // 네트워크·형식 오류: 예전 값이 있으면 그것을, 없으면 빈 값
    return hit?.value ?? fallback;
  }
}

/**
 * 무료 API가 없는 나라: 앱에 담아 둔 공휴일 (Google 캘린더 공휴일 피드에서 scripts/gen-holidays.mjs로 생성).
 * 그 나라를 고를 때만 불러온다.
 */
const BUNDLED: Record<string, () => Promise<{ default: string[][] }>> = {
  TH: () => import('../holidays/TH.json'),
  MY: () => import('../holidays/MY.json'),
};

async function loadBundled(countryCode: string, year: number): Promise<Holiday[] | null> {
  const load = BUNDLED[countryCode];
  if (!load) return null;
  const list = (await load()).default.filter(([date]) => date?.startsWith(`${year}-`));
  if (list.length === 0) return null; // 담아 둔 해를 넘어감
  return list.map(([date = '', name = '']) => ({ date, countryCode, localName: name, name }));
}

/** 한 나라·한 해의 공휴일. 지원하지 않는 나라는 null (그것도 저장해 다시 묻지 않음), 오류는 [] */
export function getHolidays(countryCode: string, year: number): Promise<Holiday[] | null> {
  if (countryCode in BUNDLED) return loadBundled(countryCode, year);
  return cached(
    `holidays:${countryCode}:${year}`,
    HOLIDAY_TTL,
    async () => {
      if (countryCode === 'TW') return loadTaiwan(year);
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
      if (res.status === 404 || res.status === 204) return null;
      if (!res.ok) throw new Error(`holidays ${res.status}`);
      // 외부 응답은 믿지 않고 필요한 칸만 확인해서 쓴다. 전국 공휴일만 (지역 공휴일 제외)
      return arr(await res.json()).flatMap((h): Holiday[] =>
        isObj(h) &&
        typeof h.date === 'string' &&
        DATE_RE.test(h.date) &&
        typeof h.localName === 'string' &&
        typeof h.name === 'string' &&
        h.global !== false
          ? [{ date: h.date, countryCode, localName: h.localName, name: h.name }]
          : [],
      );
    },
    [] as Holiday[] | null,
  );
}

/**
 * 대만: 행정원 인사행정총처 공식 근무일 달력을 옮긴 TaiwanCalendar (jsDelivr, 무료·키 없음).
 * 정부 발표 후 해마다 추가된다. 쉬는 날 중 이름이 있는 날만 (그냥 주말 제외)
 */
async function loadTaiwan(year: number): Promise<Holiday[] | null> {
  const res = await fetch(`https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`holidays ${res.status}`);
  return arr(await res.json()).flatMap((d): Holiday[] => {
    if (!isObj(d) || d.isHoliday !== true || typeof d.description !== 'string') return [];
    const ymd = typeof d.date === 'string' ? d.date : '';
    const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
    if (!d.description || !DATE_RE.test(date)) return [];
    return [
      {
        date,
        countryCode: 'TW',
        localName: d.description,
        name: TW_EN[d.description] ?? d.description,
      },
    ];
  });
}

/** 대만 공휴일 중국어 이름 → 영어 (한국어는 domain/holidays의 KO_NAMES) */
const TW_EN: Record<string, string> = {
  開國紀念日: 'Founding Day of the Republic of China',
  小年夜: 'Lunar New Year',
  農曆除夕: 'Lunar New Year',
  春節: 'Lunar New Year',
  補假: 'Substitute Holiday',
  和平紀念日: 'Peace Memorial Day',
  兒童節: "Children's Day",
  清明節: 'Tomb Sweeping Day',
  勞動節: 'Labor Day',
  端午節: 'Dragon Boat Festival',
  中秋節: 'Mid-Autumn Festival',
  '孔子誕辰紀念日/教師節': "Teachers' Day",
  國慶日: 'National Day',
  臺灣光復暨金門古寧頭大捷紀念日: 'Retrocession Day',
  行憲紀念日: 'Constitution Day',
};

/** 목적지 좌표의 일별 예보 (오늘부터 16일) */
export function getForecast(
  lat: number,
  lng: number,
  timezone: string,
): Promise<Record<LocalDate, DayWeather>> {
  const key = `weather:${lat.toFixed(2)},${lng.toFixed(2)}`;
  return cached(
    key,
    WEATHER_TTL,
    async () => {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=16` +
        `&timezone=${encodeURIComponent(timezone)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`weather ${res.status}`);
      const body: unknown = await res.json();
      const daily = isObj(body) && isObj(body.daily) ? body.daily : {};
      const codes = arr(daily.weather_code);
      const maxs = arr(daily.temperature_2m_max);
      const mins = arr(daily.temperature_2m_min);
      const out: Record<LocalDate, DayWeather> = {};
      arr(daily.time).forEach((date, i) => {
        const code = num(codes[i]);
        const max = num(maxs[i]);
        const min = num(mins[i]);
        if (
          typeof date === 'string' &&
          DATE_RE.test(date) &&
          code !== null &&
          max !== null &&
          min !== null
        )
          out[date] = { code, min, max };
      });
      return out;
    },
    {},
  );
}
