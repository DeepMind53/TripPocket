import type { StayQuery } from '../domain/lodgingLinks';

/**
 * 숙소 최저가 최근 검색 5개 (docs/28 I4): 이 기기에만. 누르면 입력 칸만 채운다 (자동 검색 아님).
 * 아고다 링크도 함께 — 다시 붙여 넣지 않게
 */
export interface RecentStay extends StayQuery {
  agoda?: string;
}

const KEY = 'tp-lodging-recent';
const MAX = 5;

export function loadRecentStays(): RecentStay[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is RecentStay =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as RecentStay).name === 'string' &&
          typeof (x as RecentStay).checkIn === 'string' &&
          typeof (x as RecentStay).checkOut === 'string' &&
          Number.isInteger((x as RecentStay).adults) &&
          Number.isInteger((x as RecentStay).rooms),
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

/** 맨 앞에 넣기 — 같은 숙소·날짜는 하나만 */
export function saveRecentStay(s: RecentStay): RecentStay[] {
  const same = (x: RecentStay) =>
    x.name === s.name && x.checkIn === s.checkIn && x.checkOut === s.checkOut;
  const next = [s, ...loadRecentStays().filter((x) => !same(x))].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장 못 해도 검색은 된다
  }
  return next;
}
