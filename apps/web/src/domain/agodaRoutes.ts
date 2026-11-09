import { nightsBetween } from '@trippocket/shared';
import type { StayQuery } from './lodgingLinks';

/**
 * 아고다 경로별 링크 (아고다스캐너 방식, docs/28 §4.2·§12.2): 아고다 숙소 주소의 접속 경로 값(CID)만 바꾼다.
 * 경로 값은 아고다스캐너 공개 페이지 스크립트(2026-11-09)에서 — 제휴 태그(tag=)·제휴 단축 링크는 넣지 않는다.
 * 아고다가 값을 바꿀 수 있어 이 파일 한 곳에만 둔다
 */
export type AgodaRouteGroup = 'search' | 'card' | 'airline';

export interface AgodaRoute {
  id: string;
  group: AgodaRouteGroup;
  cid: number;
}

/** 경로 없음 (아고다 기본) */
export const AGODA_DEFAULT_CID = -1;

export const AGODA_ROUTES = [
  { id: 'googleMaps1', group: 'search', cid: 1833981 },
  { id: 'googleMaps2', group: 'search', cid: 1917614 },
  { id: 'googleMaps3', group: 'search', cid: 1829968 },
  { id: 'googleSearch1', group: 'search', cid: 1908612 },
  { id: 'googleSearch2', group: 'search', cid: 1922868 },
  { id: 'googleSearch3', group: 'search', cid: 1776688 },
  { id: 'naverSearch', group: 'search', cid: 1729890 },
  { id: 'kb', group: 'card', cid: 1563295 },
  { id: 'woori', group: 'card', cid: 1654104 },
  { id: 'wooriMaster', group: 'card', cid: 1932810 },
  { id: 'bc', group: 'card', cid: 1748498 },
  { id: 'shinhan', group: 'card', cid: 1760133 },
  { id: 'shinhanMaster', group: 'card', cid: 1917257 },
  { id: 'toss', group: 'card', cid: 1917334 },
  { id: 'hana', group: 'card', cid: 1729471 },
  { id: 'mastercard', group: 'card', cid: 1889572 },
  { id: 'visa', group: 'card', cid: 1889319 },
  { id: 'koreanAir', group: 'airline', cid: 1904827 },
  { id: 'asiana', group: 'airline', cid: 1806212 },
  { id: 'airSeoul', group: 'airline', cid: 1800120 },
] as const satisfies readonly AgodaRoute[];

/** 아고다 공식 카드·결제 할인 안내 페이지 (숙소 링크 아님) — www.agoda.com/ko-kr/<이름> */
export const AGODA_PROMOS = [
  'kakaopaypromo',
  'kbcard',
  'hyundaipromo',
  'wooricard',
  'wooricardmaster',
  'upikrpromo',
  'unionpayKR',
  'bccard',
  'shinhancard',
  'shinhanmaster',
  'tossbank',
  'hanacard',
  'krmastercard',
  'visakorea',
  'koreanair',
  'flyasiana',
  'airseoul',
] as const;

export const agodaPromoUrl = (slug: string) => `https://www.agoda.com/ko-kr/${slug}`;

/** 아고다 숙소: 숙소 id(자동 찾기·제휴 링크) 또는 숙소 화면 주소(붙여넣기) */
export type AgodaBase = { hid: number } | { path: string };

const HID_PARAMS = ['hid', 'selectedproperty', 'hotel', 'hotel_id'];

/**
 * 붙여 넣은 글에서 아고다 숙소 찾기 (공유 글에 이름과 주소가 섞여 와도). 아고다 주소가 아니거나
 * 숙소를 알 수 없는 주소(첫 화면·짧은 공유 주소)는 null
 */
export function parseAgodaLink(text: string): AgodaBase | null {
  const raw = text.match(/https?:\/\/[^\s<>"']+/)?.[0];
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!/(^|\.)agoda\.com$/i.test(u.hostname)) return null;
  for (const key of HID_PARAMS) {
    const hid = Number(u.searchParams.get(key));
    if (Number.isInteger(hid) && hid > 0) return { hid };
  }
  // 숙소 화면: /ko-kr/hotel-gracery-shinjuku/hotel/tokyo-jp.html
  if (/\/hotel\/[^/]+\.html$/i.test(u.pathname)) return { path: u.pathname };
  return null;
}

/**
 * 경로 하나의 링크. 숙소 id면 아고다 제휴 검색 주소(경로·날짜·인원이 그대로 넘어감, 2026-11-09 확인),
 * 숙소 화면 주소면 그 주소의 날짜·인원·경로만 바꾼다 (아고다스캐너와 같음)
 */
export function agodaRouteUrl(base: AgodaBase, cid: number, q: StayQuery): string {
  if ('hid' in base) {
    const p = new URLSearchParams({
      hid: String(base.hid),
      cid: String(cid),
      checkin: q.checkIn,
      checkout: q.checkOut,
      NumberofAdults: String(q.adults),
      Rooms: String(q.rooms),
    });
    return `https://www.agoda.com/partners/partnersearch.aspx?${p}`;
  }
  const p = new URLSearchParams({
    checkIn: q.checkIn,
    los: String(nightsBetween(q.checkIn, q.checkOut)),
    adults: String(q.adults),
    rooms: String(q.rooms),
    cid: String(cid),
  });
  return `https://www.agoda.com${base.path}?${p}`;
}
