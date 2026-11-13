import type { ItineraryItem, Trip } from '@trippocket/shared';

/**
 * 2026-11-13 실험 3차 (사용자 요청 "정보만 주는 것 말고 실제 기능"): 순수 계산만 — 화면은 features/labs/*
 */

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const pad = (n: string) => n.padStart(2, '0');
const validHM = (h: string, m: string) => Number(h) < 24 && Number(m) < 60;

/** 붙여 넣을 수 있는 줄 수 (한 번에) */
export const BULK_MAX = 30;

/**
 * 여러 일정 붙여 넣기: 한 줄에 일정 하나. "10:00 센소지", "10:00~11:30 센소지", "9시 센소지", "센소지".
 * 앞의 "-", "•", "1." 같은 목록 기호는 뗀다. 빈 줄은 건너뛰고 30줄까지
 */
export function parseBulkLines(
  text: string,
): { title: string; startTime?: string; endTime?: string }[] {
  const out: { title: string; startTime?: string; endTime?: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-•·*]|\d+[.)])\s*/, '').trim();
    if (!line) continue;
    const m =
      /^(\d{1,2})(?::(\d{2})|시(?:\s*(\d{1,2})분)?)(?:\s*[~\-–]\s*(\d{1,2}):(\d{2}))?\s+(.+)$/.exec(
        line,
      );
    if (m) {
      const [, h, mm, mk, eh, em, title] = m;
      const min = mm ?? mk ?? '00';
      if (validHM(h!, min)) {
        const item: { title: string; startTime?: string; endTime?: string } = {
          title: title!.slice(0, 100),
          startTime: `${pad(h!)}:${pad(min)}`,
        };
        if (eh && em && validHM(eh, em)) item.endTime = `${pad(eh)}:${pad(em)}`;
        out.push(item);
      } else out.push({ title: line.slice(0, 100) });
    } else out.push({ title: line.slice(0, 100) });
    if (out.length >= BULK_MAX) break;
  }
  return out;
}

/**
 * 남은 일정 미루기·당기기: 시각이 있는 일정의 시작·끝을 delta분만큼. 예약에서 넘어온 일정(항공·숙소)은 그대로,
 * after를 주면 그 시각 이후 시작하는 것만. 자정을 넘거나 0시 앞으로 가면 그 일정은 건너뛴다(skipped)
 */
export function shiftPatches(
  items: readonly Pick<ItineraryItem, 'id' | 'startTime' | 'endTime' | 'bookingId' | 'kind'>[],
  delta: number,
  after?: string,
): { patches: { id: string; startTime: string; endTime?: string }[]; skipped: number } {
  const patches: { id: string; startTime: string; endTime?: string }[] = [];
  let skipped = 0;
  for (const i of items) {
    if (!i.startTime || i.bookingId || i.kind === 'note') continue;
    if (after && i.startTime < after) continue;
    const s = toMin(i.startTime) + delta;
    const e = i.endTime ? toMin(i.endTime) + delta : null;
    if (s < 0 || s > 23 * 60 + 59 || (e !== null && (e < 0 || e > 23 * 60 + 59))) {
      skipped++;
      continue;
    }
    patches.push({ id: i.id, startTime: hhmm(s), ...(e !== null ? { endTime: hhmm(e) } : {}) });
  }
  return { patches, skipped };
}

/** 캘린더 글자 이스케이프 (RFC 5545) */
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (d: string) => d.replaceAll('-', '');
const nextDay = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10).replaceAll('-', '');
};

/**
 * 캘린더 파일(.ics): 날짜가 있는 일정(메모 빼고)을 여행지 시간대로. 시각이 없으면 종일,
 * 끝 시각이 없으면 1시간. 휴대폰 캘린더·구글 캘린더에서 열면 한 번에 들어간다
 */
export function icsText(
  trip: Pick<Trip, 'title' | 'timezone'>,
  items: readonly Pick<
    ItineraryItem,
    'id' | 'date' | 'kind' | 'title' | 'startTime' | 'endTime' | 'place' | 'memo'
  >[],
  stamp: Date,
): string {
  const now = stamp
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const tz = trip.timezone;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TripPocket//KO',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(trip.title)}`,
  ];
  for (const i of items) {
    if (!i.date || i.kind === 'note') continue;
    lines.push('BEGIN:VEVENT', `UID:${i.id}@trippocket.day`, `DTSTAMP:${now}`);
    if (i.startTime) {
      const end =
        i.endTime && i.endTime > i.startTime
          ? i.endTime
          : hhmm(Math.min(toMin(i.startTime) + 60, 23 * 60 + 59));
      lines.push(
        `DTSTART;TZID=${tz}:${ymd(i.date)}T${i.startTime.replace(':', '')}00`,
        `DTEND;TZID=${tz}:${ymd(i.date)}T${end.replace(':', '')}00`,
      );
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(i.date)}`, `DTEND;VALUE=DATE:${nextDay(i.date)}`);
    }
    lines.push(`SUMMARY:${esc(i.title)}`);
    const where = i.place?.address ?? i.place?.name;
    if (where) lines.push(`LOCATION:${esc(where)}`);
    if (i.memo) lines.push(`DESCRIPTION:${esc(i.memo)}`);
    if (i.place?.coords) lines.push(`GEO:${i.place.coords.lat};${i.place.coords.lng}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

const okCoords = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * 지도 링크로 장소: 구글·애플·네이버 지도 주소에 든 좌표(와 장소 이름)를 꺼낸다. 인터넷 요청 없음 —
 * 짧은 링크(maps.app.goo.gl, naver.me)는 좌표가 없어서 null
 */
export function parseMapLink(text: string): { lat: number; lng: number; name?: string } | null {
  const url = text.trim();
  if (!/^https?:\/\//.test(url)) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const decoded = decodeURIComponent(u.pathname).replace(/\+/g, ' ');
  const name = /\/place\/([^/]+)/.exec(decoded)?.[1]?.trim();
  const named = (lat: number, lng: number) =>
    okCoords(lat, lng) ? { lat, lng, ...(name ? { name } : {}) } : null;
  // 구글: 장소 핀 좌표 !3d..!4d.. 가 가장 정확, 다음 @lat,lng
  const pin = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url);
  if (pin) return named(Number(pin[1]), Number(pin[2]));
  const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url);
  if (at) return named(Number(at[1]), Number(at[2]));
  for (const key of ['q', 'query', 'll', 'destination', 'daddr', 'sll']) {
    const v = u.searchParams.get(key);
    const m = v ? /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/.exec(v) : null;
    if (m) return named(Number(m[1]), Number(m[2]));
  }
  // 네이버 지도: ?lat=..&lng=.. 또는 c=경도,위도,줌
  const lat = u.searchParams.get('lat');
  const lng = u.searchParams.get('lng');
  if (lat && lng) return named(Number(lat), Number(lng));
  const c = u.searchParams.get('c');
  const cm = c ? /^(-?\d+\.\d+),(-?\d+\.\d+)/.exec(c) : null;
  if (cm && Math.abs(Number(cm[1])) <= 180 && Math.abs(Number(cm[2])) <= 90)
    return named(Number(cm[2]), Number(cm[1]));
  return null;
}

/** 나눠 내기: 한 사람 몫 (소수 자리수만큼 올림 — 모자라지 않게) */
export function splitShare(total: number, people: number, digits: number): number {
  if (people < 1) return total;
  const f = 10 ** digits;
  return Math.ceil((total / people) * f) / f;
}

export type UnitKind = 'temp' | 'length' | 'weight' | 'height';
/**
 * 단위 바꾸기: 미국·영국 여행 단위 ↔ 우리 단위. dir = 'toMetric'이면 °F·mile·lb·inch → °C·km·kg·cm
 */
export function convertUnit(kind: UnitKind, value: number, dir: 'toMetric' | 'fromMetric'): number {
  const r = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
  const to = dir === 'toMetric';
  switch (kind) {
    case 'temp':
      return to ? r(((value - 32) * 5) / 9) : r((value * 9) / 5 + 32);
    case 'length':
      return to ? r(value * 1.609344, 2) : r(value / 1.609344, 2);
    case 'weight':
      return to ? r(value * 0.45359237, 2) : r(value / 0.45359237, 2);
    case 'height':
      return to ? r(value * 2.54) : r(value / 2.54);
  }
}
