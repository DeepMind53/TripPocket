import type { Booking, ItineraryItem, LocalDate } from '@trippocket/shared';

/**
 * 실험실 (2026-11-03, 사용자 요청 — 예전 실험 7개는 뺐다) — 기기 안 데이터로만 계산하는 순수 함수
 */

/** 숙소 예약이 없는 밤 (여행 첫날 ~ 마지막 전날, 지운 예약 빼고) */
export function nightsWithoutStay(
  trip: { startDate: LocalDate; endDate: LocalDate },
  bookings: readonly Pick<Booking, 'kind' | 'start' | 'end' | 'deletedAt'>[],
): LocalDate[] {
  const stays = bookings.filter((b) => b.kind === 'lodging' && !b.deletedAt);
  const out: LocalDate[] = [];
  for (let t = Date.parse(trip.startDate); t < Date.parse(trip.endDate); t += 86_400_000) {
    const night = new Date(t).toISOString().slice(0, 10);
    const covered = stays.some(
      (b) => b.start.date <= night && night < (b.end?.date ?? addDay(b.start.date)),
    );
    if (!covered) out.push(night);
  }
  return out;
}
const addDay = (d: LocalDate) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);

/** 도착 공항 → 첫 숙소: 도착지(end.place)가 있는 첫 항공편과 그날(없으면 그 뒤) 첫 숙소 */
export function arrivalToStay(
  bookings: readonly Booking[],
): { from: string; to: string; date: LocalDate } | null {
  const live = bookings.filter((b) => !b.deletedAt);
  const flight = live
    .filter((b) => b.kind === 'flight' && b.end?.place)
    .sort((a, b) => a.start.date.localeCompare(b.start.date))[0];
  if (!flight?.end?.place) return null;
  const date = flight.end.date;
  const stay = live
    .filter((b) => b.kind === 'lodging' && b.start.date >= date)
    .sort((a, b) => a.start.date.localeCompare(b.start.date))[0];
  if (!stay) return null;
  return { from: flight.end.place, to: stay.details?.address || stay.title, date };
}

/** 장소 이름으로 고르는 준비 팁 (사원 복장·온천·해변·산) */
export type PlaceTip = 'dress' | 'onsen' | 'beach' | 'hike';
const TIP_WORDS: [PlaceTip, RegExp][] = [
  ['dress', /사원|사찰|신사(?!동)|모스크|성당|궁전|temple|shrine|mosque|cathedral|\bwat\b|^왓 /i],
  ['onsen', /온천|onsen|센토|sento/i],
  ['beach', /해변|해수욕장|비치|beach/i],
  ['hike', /등산|트레킹|하이킹|hike|trail|오름/i],
];
export function placeTips(items: readonly Pick<ItineraryItem, 'title'>[]): PlaceTip[] {
  return TIP_WORDS.filter(([, re]) => items.some((i) => re.test(i.title))).map(([k]) => k);
}

/** 오프라인 준비: 바우처 링크만 있고 기기에 문서가 없는 예약 수 */
export const vouchersNotSaved = (
  bookings: readonly Booking[],
  withDocs: ReadonlySet<string>,
): number =>
  bookings.filter((b) => !b.deletedAt && b.details?.voucherUrl && !withDocs.has(b.id)).length;

/** 바우처: 링크가 있거나 문서를 붙인 예약 (2026-11-02 문서도), 날짜·시각 순 */
export const voucherBookings = (
  bookings: readonly Booking[],
  withDocs: ReadonlySet<string> = new Set(),
) =>
  bookings
    .filter((b) => !b.deletedAt && (b.details?.voucherUrl || withDocs.has(b.id)))
    .sort((a, b) =>
      `${a.start.date} ${a.start.time ?? ''}`.localeCompare(
        `${b.start.date} ${b.start.time ?? ''}`,
      ),
    );
