import type { Booking } from '@trippocket/shared';

/**
 * 공항마다 색 (2026-11-25 사용자 요청): 갈 때·올 때 공항이 다를 수 있어(나리타 도착 → 하네다 출발)
 * 같은 공항은 같은 색 점선, 다른 공항은 다른 색으로 한눈에 구분한다.
 * 항공 예약이 2개 이상일 때만 (하나면 비교할 것이 없다). 날짜 순서로 처음 나온 공항부터 0, 1, 2…
 */
export function airportColorIndex(bookings: readonly Booking[] | undefined): Map<string, number> {
  const flights = (bookings ?? [])
    .filter((b) => b.kind === 'flight' && !b.deletedAt)
    .sort((a, b) =>
      `${a.start.date} ${a.start.time ?? ''}`.localeCompare(
        `${b.start.date} ${b.start.time ?? ''}`,
      ),
    );
  const out = new Map<string, number>();
  if (flights.length < 2) return out;
  for (const f of flights)
    for (const p of [f.start.place, f.end?.place]) {
      const code = p?.trim().toUpperCase();
      if (code && !out.has(code)) out.set(code, out.size);
    }
  // 공항이 하나뿐이면(같은 공항 왕복만) 칠할 필요가 없다
  return out.size > 1 ? out : new Map();
}
