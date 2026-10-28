import type { Booking, ItineraryItem, LocalDate } from '@trippocket/shared';

/**
 * 실험실 3차 (2026-10-28, Google 여행·트리플·마이리얼트립·Kayak·TripIt 참고) — 기기 안 데이터로만 계산하는 순수 함수.
 * 나라별 정보는 널리 알려진 참고 정보 (안내 문구에 "참고"를 붙인다)
 */

/** 좌측 통행 나라 (운전석 오른쪽) */
const LEFT_DRIVE = new Set([
  'JP',
  'HK',
  'MO',
  'SG',
  'MY',
  'TH',
  'ID',
  'IN',
  'LK',
  'NP',
  'BN',
  'MV',
  'AU',
  'NZ',
  'FJ',
  'GB',
  'IE',
  'MT',
  'CY',
  'ZA',
  'KE',
  'MU',
]);
export const isLeftDrive = (countryCode: string) => LEFT_DRIVE.has(countryCode);

/** 수돗물: ok = 마셔도 됨, boil = 끓이거나 생수 권장, no = 생수 */
const TAP: Record<string, 'ok' | 'boil' | 'no'> = {
  JP: 'ok',
  SG: 'ok',
  HK: 'boil',
  MO: 'boil',
  TW: 'boil',
  CN: 'no',
  TH: 'no',
  VN: 'no',
  PH: 'no',
  MY: 'boil',
  ID: 'no',
  KH: 'no',
  LA: 'no',
  MN: 'no',
  IN: 'no',
  US: 'ok',
  CA: 'ok',
  GU: 'boil',
  MP: 'boil',
  AU: 'ok',
  NZ: 'ok',
  GB: 'ok',
  IE: 'ok',
  FR: 'ok',
  DE: 'ok',
  IT: 'ok',
  ES: 'ok',
  PT: 'ok',
  NL: 'ok',
  CH: 'ok',
  AT: 'ok',
  CZ: 'ok',
  TR: 'no',
  AE: 'no',
  EG: 'no',
  MX: 'no',
};
export const tapWater = (countryCode: string) => TAP[countryCode] ?? null;

/** 주말(토·일)과 한국 공휴일을 뺀 여행 날짜 수 = 필요한 연차 */
export function leaveDaysNeeded(
  start: LocalDate,
  end: LocalDate,
  krHolidays: ReadonlySet<LocalDate>,
): number {
  let n = 0;
  for (let t = Date.parse(start); t <= Date.parse(end); t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    const date = new Date(t).toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !krHolidays.has(date)) n++;
  }
  return n;
}

/** 이 여행 나라 중 지난 여행에서 한 번도 안 가 본 나라 (한국 빼고) */
export function firstVisitCountries(
  trip: { id: string; destinations: readonly { countryCode?: string | undefined }[] },
  others: readonly {
    id: string;
    endDate: LocalDate;
    deletedAt?: string | undefined;
    destinations: readonly { countryCode?: string | undefined }[];
  }[],
  today: LocalDate,
): string[] {
  const been = new Set(
    others
      .filter((o) => o.id !== trip.id && !o.deletedAt && o.endDate < today)
      .flatMap((o) => o.destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []))),
  );
  return [
    ...new Set(trip.destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []))),
  ].filter((c) => c !== 'KR' && !been.has(c));
}

/** 무료 취소 마감이 오늘부터 within일 안인 예약 (가까운 순) */
export function cancelSoon(
  bookings: readonly Booking[],
  today: LocalDate,
  within = 3,
): { name: string; d: number }[] {
  return bookings
    .filter((b) => !b.deletedAt && b.details?.cancelBy && b.details.cancelBy >= today)
    .map((b) => ({
      name: b.title,
      d: Math.round((Date.parse(b.details!.cancelBy!) - Date.parse(today)) / 86_400_000),
    }))
    .filter((x) => x.d <= within)
    .sort((a, b) => a.d - b.d);
}

/** 현장 결제 예약 */
export const onsiteBookings = (bookings: readonly Booking[]) =>
  bookings.filter((b) => !b.deletedAt && b.details?.payment === 'onsite');

/** 바우처 링크가 있는 예약 (날짜 순) */
export const voucherBookings = (bookings: readonly Booking[]) =>
  bookings
    .filter((b) => !b.deletedAt && b.details?.voucherUrl)
    .sort((a, b) => a.start.date.localeCompare(b.start.date));

/** 그날 첫 일정이 7시 전이면 그 시각 (메모 빼고) */
export function earlyStartAt(
  items: readonly Pick<ItineraryItem, 'kind' | 'startTime'>[],
): string | null {
  const first = items
    .filter((i) => i.kind !== 'note' && i.startTime)
    .map((i) => i.startTime!)
    .sort()[0];
  return first && first < '07:00' ? first : null;
}
