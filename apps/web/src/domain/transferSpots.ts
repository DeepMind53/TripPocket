import { addDays, findAirport, type Booking, type LocalDate } from '@trippocket/shared';

/**
 * 픽업·드랍 타는 곳·내리는 곳 빠른 선택 (사용자 요청 2026-11-24): 이미 넣은 항공 예약의 공항과 숙소.
 * 픽업(공항 → 숙소)은 도착 공항, 드랍(숙소 → 공항)은 출발 공항. 공항을 고르면 그 항공편 편명·날짜도 함께 채운다
 */
export interface TransferSpot {
  key: string;
  kind: 'airport' | 'lodging';
  name: string;
  coords?: { lat: number; lng: number } | undefined;
  /** 공항: 그 항공편 (픽업이면 도착, 드랍이면 출발) */
  flightNo?: string | undefined;
  date?: LocalDate | undefined;
  /** 그 공항의 항공편 시각 — 픽업은 도착(시간 칸이 비면 채움), 드랍은 출발(추천 시간 계산) */
  time?: string | undefined;
  /** 국제선 (드랍 추천: 국제선 3시간·국내선 1시간 전 공항 도착) */
  international?: boolean | undefined;
}

function isInternational(b: Booking): boolean {
  const a = findAirport(b.start.place ?? '')?.countryCode;
  const z = findAirport(b.end?.place ?? '')?.countryCode;
  return !a || !z || a !== z;
}

/**
 * 드랍 추천 출발 시각 (사용자 요청 2026-11-24): 이륙 − 차로 가는 시간 − (국제선 3시간 · 국내선 1시간), 10분 단위로 내림.
 * 자정을 넘어가면 전날
 */
export function dropSuggestion(
  flight: { date: LocalDate; time: string },
  driveMin: number,
  international: boolean,
): { date: LocalDate; time: string; leadHours: number } {
  const leadHours = international ? 3 : 1;
  const [h, m] = flight.time.split(':').map(Number) as [number, number];
  let mins = h * 60 + m - driveMin - leadHours * 60;
  mins = Math.floor(mins / 10) * 10;
  let date = flight.date;
  while (mins < 0) {
    mins += 1440;
    date = addDays(date, -1);
  }
  const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  return { date, time, leadHours };
}

export function transferSpots(
  bookings: readonly Booking[],
  direction: 'pickup' | 'drop',
): { airports: TransferSpot[]; lodgings: TransferSpot[] } {
  const airports: TransferSpot[] = [];
  const lodgings: TransferSpot[] = [];
  const seen = new Set<string>();
  const sorted = [...bookings].sort((a, b) => a.start.date.localeCompare(b.start.date));
  for (const b of sorted) {
    if (b.kind === 'flight') {
      const pickup = direction === 'pickup';
      const point = pickup ? b.end : b.start;
      const code = point?.place;
      if (!code) continue;
      const terminal = pickup ? b.details?.arrivalTerminal : b.details?.terminal;
      const a = findAirport(code);
      const name = [a?.name ?? code, terminal].filter(Boolean).join(' ').slice(0, 100);
      const key = `a:${name}:${point.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      airports.push({
        key,
        kind: 'airport',
        name,
        coords: a?.coords,
        flightNo: b.details?.flightNo,
        date: point.date,
        time: point.time,
        international: isInternational(b),
      });
    } else if (b.kind === 'lodging') {
      const key = `l:${b.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lodgings.push({ key, kind: 'lodging', name: b.title.slice(0, 100), coords: b.start.coords });
    }
  }
  return { airports, lodgings };
}
