import { findAirport, type LocalDate } from '@trippocket/shared';

/**
 * 예약 확인 화면 캡처 → 예약 칸 (실험실 bookingScan, 사용자 요청 2026-11-24, ADR-0012 추가).
 * 읽은 글은 기기 안에서만 나눈다 (AI에 보내지 않음). 못 찾은 칸은 비워 둔다
 */
export interface BookingScan {
  flightNo?: string;
  /** 공항 코드 (앱 공항 목록에 있는 것만, 나온 순서) */
  airports: string[];
  /** 나온 순서 */
  dates: LocalDate[];
  times: string[];
  confirmationNo?: string;
  phone?: string;
  /** 숙소 이름 ("숙소명: …", "Hotel: …" 같은 줄에서) */
  name?: string;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): LocalDate | undefined {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 글 속 날짜를 나온 순서대로 (같은 날짜는 한 번) */
function datesOf(text: string): LocalDate[] {
  const found: { at: number; date: LocalDate }[] = [];
  const push = (at: number, date: LocalDate | undefined) => date && found.push({ at, date });
  for (const m of text.matchAll(/(20\d{2})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?/g))
    push(m.index, validDate(Number(m[1]), Number(m[2]), Number(m[3])));
  // 24 Nov 2026 · 24 November 2026
  for (const m of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(20\d{2})\b/g)) {
    const mon = MONTHS.indexOf(m[2]!.toLowerCase());
    if (mon >= 0) push(m.index, validDate(Number(m[3]), mon + 1, Number(m[1])));
  }
  // Nov 24, 2026
  for (const m of text.matchAll(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/g)) {
    const mon = MONTHS.indexOf(m[1]!.toLowerCase());
    if (mon >= 0) push(m.index, validDate(Number(m[3]), mon + 1, Number(m[2])));
  }
  found.sort((a, b) => a.at - b.at);
  return [...new Set(found.map((f) => f.date))];
}

function timesOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g)) {
    const t = `${pad(Number(m[1]))}:${m[2]}`;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

const NO_WORDS = String.raw`(?:예약\s*번호|예약\s*코드|확인\s*번호|booking\s*(?:reference|number|no\.?|code|id)|confirmation\s*(?:number|no\.?|code)|reservation\s*(?:number|no\.?|code)|pnr|itinerary\s*(?:number|no\.?))`;

export function scanBooking(text: string): BookingScan {
  const upper = text.toUpperCase();
  // 숫자 묶음은 띄어 써도 하나로 ("4821 553 190" → "4821553190")
  const no = new RegExp(
    String.raw`${NO_WORDS}\s*[:#.]?\s*(\d{3,}(?:[ -]\d{2,})*(?![A-Z0-9])|[A-Z0-9][A-Z0-9-]{4,19})`,
    'i',
  )
    .exec(text)?.[1]
    ?.replace(/\s+/g, '');
  // 편명: 항공사 코드 2자리 + 숫자 2~4 ("KE 703", "7C1101").
  // "T2 267"(터미널·게이트)은 빼고, 편명·flight 글자 뒤를 먼저 본다
  const flightRe = /\b(?!T\d)([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/;
  const key = /편명|FLIGHT/.exec(upper);
  const flight = (key && flightRe.exec(upper.slice(key.index))) || flightRe.exec(upper);
  const airports: string[] = [];
  for (const m of upper.matchAll(/\b([A-Z]{3})\b/g)) {
    const code = m[1]!;
    if (findAirport(code)?.iata === code && !airports.includes(code)) airports.push(code);
  }
  const phone = /(?:전화|연락처|tel|phone)\s*[:.]?\s*(\+?[\d][\d\s()-]{6,20}\d)/i.exec(text)?.[1];
  const name = /(?:숙소\s*명|호텔\s*명|숙소|hotel\s*name|property|hotel)\s*[:：]\s*([^\n]{2,80})/i
    .exec(text)?.[1]
    ?.trim();
  return {
    ...(flight ? { flightNo: `${flight[1]}${flight[2]}` } : {}),
    airports,
    dates: datesOf(text),
    times: timesOf(text),
    ...(no ? { confirmationNo: no.toUpperCase() } : {}),
    ...(phone ? { phone: phone.trim() } : {}),
    ...(name ? { name } : {}),
  };
}

/** 캡처로 채울 수 있는 예약 칸 (BookingForm 상태의 일부) */
export interface ScanTarget {
  flightNo: string;
  from: string;
  to: string;
  title: string;
  phone: string;
  confirmationNo: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

/**
 * 나눈 글 → 예약 칸. 글자 칸은 비어 있을 때만, 날짜·시각은 새 예약(초기값)이거나 비어 있을 때만 바꾼다.
 * 몇 칸을 채웠는지 함께 돌려준다
 */
export function applyScan(
  kind: string,
  scan: BookingScan,
  cur: ScanTarget,
  isNew: boolean,
): { patch: Partial<ScanTarget>; filled: number } {
  const patch: Partial<ScanTarget> = {};
  const text = (k: keyof ScanTarget, v: string | undefined) => {
    if (v && !cur[k].trim()) patch[k] = v;
  };
  const when = (k: keyof ScanTarget, v: string | undefined) => {
    if (v && (isNew || !cur[k]) && cur[k] !== v) patch[k] = v;
  };
  text('confirmationNo', scan.confirmationNo?.slice(0, 60));
  const [d1, d2] = scan.dates;
  const [t1, t2] = scan.times;
  if (kind === 'flight') {
    text('flightNo', scan.flightNo);
    text('from', scan.airports[0]);
    text('to', scan.airports[1]);
    when('startDate', d1);
    when('endDate', d2 ?? d1);
    when('startTime', t1);
    when('endTime', t2);
  } else if (kind === 'lodging') {
    text('title', scan.name?.slice(0, 100));
    text('phone', scan.phone?.slice(0, 40));
    when('startDate', d1);
    when('endDate', d2);
    when('startTime', t1);
    when('endTime', t2);
  } else {
    if (kind !== 'car' && kind !== 'train') text('title', scan.name?.slice(0, 100));
    text('phone', scan.phone?.slice(0, 40));
    when('startDate', d1);
    when('startTime', t1);
  }
  return { patch, filled: Object.keys(patch).length };
}
