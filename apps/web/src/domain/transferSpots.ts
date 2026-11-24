import { findAirport, type Booking, type LocalDate } from '@trippocket/shared';

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
  /** 픽업: 도착 시각 — 시간 칸이 비어 있으면 채운다 */
  time?: string | undefined;
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
        time: pickup ? point.time : undefined,
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
