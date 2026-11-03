/**
 * 미세먼지·자외선 (docs/26 A3, 실험실 "미세먼지·자외선" 2026-11-03) — 순수 함수.
 * 미세먼지(PM2.5)는 하루 평균을 한국 환경부 기준으로: 좋음 ~15 · 보통 ~35 · 나쁨 ~75 · 매우 나쁨 76~ (㎍/㎥).
 * 자외선은 하루 최고를 세계보건기구 기준으로: 8~10 매우 높음 · 11~ 위험
 */
export interface DayAir {
  /** PM2.5 하루 평균 (㎍/㎥, 반올림) */
  pm25?: number;
  /** 자외선 지수 하루 최고 (반올림) */
  uv?: number;
}

export type AirWarn = 'pm25Bad' | 'pm25VeryBad' | 'uvVeryHigh' | 'uvExtreme';

/** 알릴 만한 것만 (나쁨 이상·매우 높음 이상) */
export function airWarnings(air: DayAir | undefined): { key: AirWarn; v: number }[] {
  if (!air) return [];
  const out: { key: AirWarn; v: number }[] = [];
  if (air.pm25 !== undefined && air.pm25 > 35)
    out.push({ key: air.pm25 > 75 ? 'pm25VeryBad' : 'pm25Bad', v: air.pm25 });
  if (air.uv !== undefined && air.uv >= 8)
    out.push({ key: air.uv >= 11 ? 'uvExtreme' : 'uvVeryHigh', v: air.uv });
  return out;
}

/** 시간별 값("2026-11-03T10:00") → 날짜별 PM2.5 평균·자외선 최고 */
export function dailyAir(
  times: readonly unknown[],
  pm25: readonly unknown[],
  uv: readonly unknown[],
): Record<string, DayAir> {
  const sum: Record<string, { pm: number[]; uv: number[] }> = {};
  times.forEach((at, i) => {
    if (typeof at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(at)) return;
    const d = (sum[at.slice(0, 10)] ??= { pm: [], uv: [] });
    const p = pm25[i];
    const u = uv[i];
    if (typeof p === 'number' && Number.isFinite(p)) d.pm.push(p);
    if (typeof u === 'number' && Number.isFinite(u)) d.uv.push(u);
  });
  const out: Record<string, DayAir> = {};
  for (const [date, d] of Object.entries(sum)) {
    const day: DayAir = {};
    if (d.pm.length) day.pm25 = Math.round(d.pm.reduce((a, b) => a + b, 0) / d.pm.length);
    if (d.uv.length) day.uv = Math.round(Math.max(...d.uv));
    out[date] = day;
  }
  return out;
}
