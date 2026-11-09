import { nightlyOf, type LodgingReportView } from '@trippocket/shared';

/**
 * 숙소 가격 기록 화면 계산 (docs/28 §6·§7): 1박 원화로 맞추기, 같은 날짜 먼저·싼 순, 이상한 값, 경로별 최근 기록·자주 싼 경로.
 * rates = 1단위 원화 (fxService). 환율을 모르는 통화는 원화 비교에서 빼고 뒤에 둔다
 */
export interface StayKey {
  checkIn: string;
  nights: number;
  adults: number;
}

export interface ArrangedReport extends LodgingReportView {
  /** 1박 원화 (환율 모르면 null) */
  nightlyKrw: number | null;
  /** 총액을 박 수로 나눴거나 다른 통화를 환산함 */
  converted: boolean;
  /** 같은 날짜 기록 중앙값보다 5배↑ 또는 1/5↓ — "확인 필요", 최저가에서 뺀다 */
  odd: boolean;
}

export const STALE_DAYS = 7;

export function toNightlyKrw(
  r: Pick<LodgingReportView, 'price' | 'priceType' | 'nights' | 'currency'>,
  rates: Record<string, number> | undefined,
): number | null {
  const nightly = nightlyOf(r);
  if (r.currency === 'KRW') return nightly;
  const rate = rates?.[r.currency];
  return rate ? Math.round(nightly * rate) : null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const sameStay = (r: StayKey, s: StayKey) =>
  r.checkIn === s.checkIn && r.nights === s.nights && r.adults === s.adults;

/** 같은 날짜·인원 / 다른 날짜로 나누고, 싼 순 (환율 모르는 것은 뒤). 같은 날짜에서만 이상한 값을 본다 */
export function arrangeReports(
  list: readonly LodgingReportView[],
  stay: StayKey,
  rates: Record<string, number> | undefined,
): { same: ArrangedReport[]; other: ArrangedReport[]; cheapest: ArrangedReport | null } {
  const withKrw = list.map((r) => ({
    ...r,
    nightlyKrw: toNightlyKrw(r, rates),
    converted: r.priceType === 'total' || r.currency !== 'KRW',
    odd: false,
  }));
  const byPrice = (a: ArrangedReport, b: ArrangedReport) =>
    (a.nightlyKrw ?? Infinity) - (b.nightlyKrw ?? Infinity) || b.seenOn.localeCompare(a.seenOn);
  const same = withKrw.filter((r) => sameStay(r, stay));
  const known = same.flatMap((r) => (r.nightlyKrw === null ? [] : [r.nightlyKrw]));
  if (known.length >= 3) {
    const mid = median(known);
    for (const r of same)
      if (r.nightlyKrw !== null) r.odd = r.nightlyKrw > mid * 5 || r.nightlyKrw < mid / 5;
  }
  same.sort(byPrice);
  const other = withKrw.filter((r) => !sameStay(r, stay)).sort(byPrice);
  return { same, other, cheapest: same.find((r) => !r.odd && r.nightlyKrw !== null) ?? null };
}

/** 7일이 지난 기록 — 흐리게 + "가격이 바뀌었을 수 있어요" */
export function isStale(seenOn: string, today: string): boolean {
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${seenOn}T00:00:00Z`)) / 86_400_000;
  return days > STALE_DAYS;
}

/** 아고다 경로 줄 옆에 보여 줄 그 경로의 가장 최근 기록 (같은 날짜·인원만) */
export function latestByRoute(same: readonly ArrangedReport[]): Map<string, ArrangedReport> {
  const out = new Map<string, ArrangedReport>();
  for (const r of [...same].sort((a, b) => b.seenOn.localeCompare(a.seenOn)))
    if (r.site === 'agoda' && r.route && !r.odd && !out.has(r.route)) out.set(r.route, r);
  return out;
}

/**
 * "이 숙소는 ○○ 경로가 자주 쌌어요" (docs/28 I8): 30일 기록에서 본 날짜마다 아고다 경로 중 가장 싼 경로를 세어
 * 가장 많이 1등한 경로. 아고다 경로 기록이 3개 이상일 때만
 */
export function cheapRoute(list: readonly ArrangedReport[]): string | null {
  const agoda = list.filter(
    (r) => r.site === 'agoda' && r.route && !r.odd && r.nightlyKrw !== null,
  );
  if (agoda.length < 3) return null;
  const groups = new Map<string, ArrangedReport[]>();
  for (const r of agoda) {
    const k = `${r.checkIn}|${r.nights}|${r.adults}|${r.seenOn}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const wins = new Map<string, number>();
  for (const g of groups.values()) {
    const best = g.reduce((a, b) => (b.nightlyKrw! < a.nightlyKrw! ? b : a));
    wins.set(best.route!, (wins.get(best.route!) ?? 0) + 1);
  }
  return [...wins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
