/**
 * 일출·일몰 시각 (실험실 "일출·일몰", 2026-10-27) — NOAA 태양 위치 근사식, 외부 호출 없음.
 * 결과는 그 시간대의 "HH:mm". 극지방처럼 해가 안 지거나 안 뜨는 날은 null. 오차는 보통 1~2분
 */
const rad = Math.PI / 180;

/** 그 날짜(UTC 자정 기준) 해가 뜨고 지는 UTC 시각(ms) */
function sunUtc(date: string, lat: number, lng: number): { rise: number; set: number } | null {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const day0 = Date.UTC(y, m - 1, d);
  const n = Math.round((day0 - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  const g = ((2 * Math.PI) / 365) * (n - 1 + 0.5);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const cosH =
    Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) -
    Math.tan(lat * rad) * Math.tan(decl);
  if (cosH < -1 || cosH > 1) return null;
  const ha = Math.acos(cosH) / rad;
  const noon = 720 - 4 * lng - eqTime;
  return { rise: day0 + (noon - 4 * ha) * 60_000, set: day0 + (noon + 4 * ha) * 60_000 };
}

const hm = (ms: number, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ms);

export function sunTimes(
  date: string,
  coords: { lat: number; lng: number },
  timeZone: string,
): { rise: string; set: string } | null {
  // 현지 날짜와 UTC 날짜가 어긋나는 곳(예: 한국 아침)도 그 현지 날짜의 해를 고른다
  for (const shift of [0, -1, 1]) {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    const day = new Date(Date.UTC(y, m - 1, d + shift)).toISOString().slice(0, 10);
    const s = sunUtc(day, coords.lat, coords.lng);
    if (!s) return null;
    const localDay = new Intl.DateTimeFormat('en-CA', { timeZone }).format(s.rise);
    if (localDay === date) return { rise: hm(s.rise, timeZone), set: hm(s.set, timeZone) };
  }
  return null;
}
