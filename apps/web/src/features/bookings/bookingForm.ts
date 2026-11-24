import { addDays, diffDays, type Booking, type Trip } from '@trippocket/shared';
import { t } from '../../i18n';
import { bookingDefaultTimes } from '../../domain/defaultTimes';
import { joinBaggage, splitBaggage } from '../../domain/flightBaggage';
import type { NewBooking } from '../../data/repositories/bookingRepo';

/** 예약 추가·편집 양식의 값과 저장할 예약으로 바꾸기 (화면 없이 — BookingFormSheet가 씀) */

/**
 * 종류별 추가 칸 (사용자 요청 2026-10-28 — 종류에 필요한 칸만). 항공 수하물·렌터카 반납·보험·기차 호차는 그 종류 화면에서만
 */
export const CANCEL_KINDS = new Set<Booking['kind']>([
  'lodging',
  'train',
  'car',
  'transfer',
  'tour',
  'ticket',
  'other',
]);
export const PAYMENT_KINDS = new Set<Booking['kind']>(['lodging', 'car', 'transfer', 'tour']);
export const VOUCHER_KINDS = new Set<Booking['kind']>(['transfer', 'tour', 'ticket', 'other']);
export const PARTY_KINDS = new Set<Booking['kind']>(['tour', 'ticket']);
/** 이름 검색으로 장소를 고르는 예약 (좌표는 start.coords에) */
export const PICK_KINDS = new Set<Booking['kind']>(['lodging', 'restaurant']);
/** 고른 장소의 전화번호를 연락처 칸에 채우는 종류 (해외 Google은 고를 때 한 번 더 확인, 2026-11-24) */
export const PHONE_KINDS = new Set<Booking['kind']>(['lodging', 'restaurant', 'car']);

export const KINDS: Booking['kind'][] = [
  'flight',
  'lodging',
  'restaurant',
  'train',
  'car',
  'transfer',
  'tour',
  'ticket',
  'other',
];

/** 빈 문자열 → undefined (저장소에서 그 항목을 지운다) */
const v = (s: string) => (s.trim() ? s.trim() : undefined);

/** undefined 값을 가진 키를 뺀다 (exactOptionalPropertyTypes) */
function clean<T extends object>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, val]) => val !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

function cleanOrUndefined<T extends object>(obj: T) {
  const c = clean(obj);
  return Object.keys(c).length ? c : undefined;
}

/** 양식 처음 값: 고치는 예약이면 그 값, 새 예약이면 종류별 기본 시각 */
export function initialBookingForm(
  trip: Trip,
  b: Booking | undefined,
  initialKind: Booking['kind'] | undefined,
) {
  return {
    title: b?.title ?? '',
    provider: b?.provider ?? '',
    flightNo: b?.details?.flightNo ?? '',
    from: b?.start.place ?? '',
    to: b?.end?.place ?? '',
    // 장소 검색으로 고른 좌표 (이름을 고치면 지운다)
    fromCoords: b?.start.coords as { lat: number; lng: number } | undefined,
    toCoords: b?.end?.coords as { lat: number; lng: number } | undefined,
    // 역을 고르면 채우는 주소 (2026-11-03)
    fromAddress: b?.start.address,
    toAddress: b?.end?.address,
    carModel: b?.details?.carModel ?? '',
    plate: b?.details?.plate ?? '',
    startDate: b?.start.date ?? trip.startDate,
    // 새 숙소 15:00, 새 식당 12:00 (사용자 요청 2026-11-04)
    startTime: b ? (b.start.time ?? '') : bookingDefaultTimes(initialKind ?? 'flight').start,
    endDate: b?.end?.date ?? '',
    endTime: b ? (b.end?.time ?? '') : bookingDefaultTimes(initialKind ?? 'flight').end,
    seat: b?.details?.seat ?? '',
    terminal: b?.details?.terminal ?? '',
    arrivalTerminal: b?.details?.arrivalTerminal ?? '',
    confirmationNo: b?.confirmationNo ?? '',
    address: b?.details?.address ?? '',
    phone: b?.details?.phone ?? '',
    priceNote: b?.priceNote ?? '',
    partySize: b?.details?.partySize ? String(b.details.partySize) : '',
    direction: (b?.details?.direction ?? 'pickup') as 'pickup' | 'drop',
    breakfast: b?.details?.breakfast ?? false,
    /** null = 모든 아침 */
    breakfastDates: (b?.details?.breakfastDates ?? null) as string[] | null,
    memo: b?.memo ?? '',
    roomType: b?.details?.roomType ?? '',
    // 기내·위탁 따로 (사용자 요청 2026-11-24) — 저장은 한 줄 글자
    baggageCabin: splitBaggage(b?.details?.baggage).cabin,
    baggageChecked: splitBaggage(b?.details?.baggage).checked,
    cancelBy: b?.details?.cancelBy ?? '',
    payment: (b?.details?.payment ?? '') as '' | 'paid' | 'onsite',
    meetingPoint: b?.details?.meetingPoint ?? '',
    voucherUrl: b?.details?.voucherUrl ?? '',
    insurance: b?.details?.insurance ?? '',
    // 투어 만나는 곳을 검색해 고른 좌표 (2026-11-24) — 일정에서 길찾기
    meetCoords:
      b?.kind === 'tour' ? (b.start.coords as { lat: number; lng: number } | undefined) : undefined,
  };
}

export type BookingFormValues = ReturnType<typeof initialBookingForm>;

/** 끝 날짜: 숙소 체크아웃 기본값은 여행 마지막 날 (체크인보다 뒤일 때), 아니면 다음 날 */
export function bookingEndDate(kind: Booking['kind'], f: BookingFormValues, trip: Trip): string {
  return (
    f.endDate ||
    (kind === 'lodging'
      ? diffDays(f.startDate, trip.endDate) > 0
        ? trip.endDate
        : addDays(f.startDate, 1)
      : f.startDate)
  );
}

/** 조식 아침들: 체크인 다음 날 ~ 체크아웃 날 */
export function morningsOf(start: string, end: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= diffDays(start, end); i++) out.push(addDays(start, i));
  return out;
}

/** 종류별 입력값 → 저장할 예약. 문제가 있으면 안내 문구 */
export function buildBooking(
  kind: Booking['kind'],
  f: BookingFormValues,
  trip: Trip,
): NewBooking | string {
  const endDate = bookingEndDate(kind, f, trip);
  const mornings = morningsOf(f.startDate, endDate);
  const voucher = v(f.voucherUrl);
  if (voucher && VOUCHER_KINDS.has(kind) && !/^https:\/\/\S+$/.test(voucher))
    return t('bookings.voucherBad');
  // 여러 종류가 함께 쓰는 추가 칸 (그 종류에 있는 칸만)
  const extras = {
    cancelBy: CANCEL_KINDS.has(kind) ? v(f.cancelBy) : undefined,
    payment: PAYMENT_KINDS.has(kind) && f.payment ? f.payment : undefined,
    voucherUrl: VOUCHER_KINDS.has(kind) ? voucher : undefined,
  };
  const partyNo = Number(f.partySize);
  const party = Number.isInteger(partyNo) && partyNo >= 1 && partyNo <= 99 ? partyNo : undefined;
  const common = {
    tripId: trip.id,
    kind,
    confirmationNo: v(f.confirmationNo),
    memo: v(f.memo),
  };
  if (kind === 'flight') {
    if (!v(f.flightNo) && !v(f.from) && !v(f.to) && !v(f.title)) return t('bookings.needFlight');
    const title =
      v(f.title) ??
      t('bookings.flightTitle', {
        flightNo: f.flightNo.trim().toUpperCase(),
        from: f.from.trim().toUpperCase(),
        to: f.to.trim().toUpperCase(),
      }).trim();
    return clean({
      ...common,
      title,
      provider: v(f.provider),
      start: clean({ date: f.startDate, time: v(f.startTime), place: v(f.from)?.toUpperCase() }),
      end: clean({ date: endDate, time: v(f.endTime), place: v(f.to)?.toUpperCase() }),
      details: cleanOrUndefined({
        flightNo: v(f.flightNo)?.toUpperCase(),
        seat: v(f.seat),
        terminal: v(f.terminal),
        arrivalTerminal: v(f.arrivalTerminal),
        baggage: joinBaggage({ cabin: f.baggageCabin, checked: f.baggageChecked }),
      }),
    });
  }
  if (kind === 'transfer') {
    return clean({
      ...common,
      // 이름을 비우면 "공항 픽업" / "공항 드랍"
      title: v(f.title) ?? t(`bookings.transferTitle.${f.direction}`),
      provider: v(f.provider),
      // 검색·예약에서 고른 곳은 좌표도 (2026-11-24) — 일정에서 길찾기
      start: clean({
        date: f.startDate,
        time: v(f.startTime),
        place: v(f.from),
        coords: v(f.from) ? f.fromCoords : undefined,
      }),
      end: v(f.to) ? clean({ date: f.startDate, place: v(f.to), coords: f.toCoords }) : undefined,
      details: cleanOrUndefined({
        direction: f.direction,
        flightNo: v(f.flightNo)?.toUpperCase(),
        phone: v(f.phone),
        partySize: party,
        meetingPoint: v(f.meetingPoint),
        ...extras,
      }),
      priceNote: v(f.priceNote),
    });
  }
  // 렌터카: 이름 대신 차종·차량번호 (사용자 요청 2026-11-02) — 둘 다 비면 "렌터카"
  const carTitle =
    kind === 'car'
      ? [v(f.carModel), v(f.plate)?.toUpperCase()].filter(Boolean).join(' ') || t('bookingKind.car')
      : undefined;
  if (!carTitle && !v(f.title)) return t('bookings.needName');
  if (kind === 'restaurant') {
    return clean({
      ...common,
      title: f.title.trim(),
      provider: v(f.provider),
      start: clean({ date: f.startDate, time: v(f.startTime) }),
      details: cleanOrUndefined({
        address: v(f.address),
        phone: v(f.phone),
        partySize: party,
      }),
      priceNote: v(f.priceNote),
    });
  }
  if (kind === 'lodging') {
    if (diffDays(f.startDate, endDate) < 1) return t('bookings.checkOutBeforeIn');
    return clean({
      ...common,
      title: f.title.trim(),
      provider: v(f.provider),
      start: clean({ date: f.startDate, time: v(f.startTime) }),
      end: clean({ date: endDate, time: v(f.endTime) }),
      details: cleanOrUndefined({
        address: v(f.address),
        phone: v(f.phone),
        roomType: v(f.roomType),
        partySize: party,
        ...extras,
        breakfast: f.breakfast || undefined,
        // 모든 아침이면 날짜 목록은 저장하지 않는다 (날짜를 바꿔도 그대로 "모두")
        breakfastDates:
          f.breakfast && f.breakfastDates && f.breakfastDates.length < mornings.length
            ? mornings.filter((d) => f.breakfastDates!.includes(d))
            : undefined,
      }),
      priceNote: v(f.priceNote),
    });
  }
  // 기차·렌터카·투어·티켓·기타
  const placed = kind === 'train' || kind === 'car';
  // 기차·버스 도착역 (2026-11-03): 출발 날짜와 같은 날로
  // 도착 시각이 출발보다 이르면 다음 날 도착 (야간열차·버스)
  const trainArrive =
    kind === 'train' && (v(f.to) || v(f.endTime))
      ? clean({
          date:
            f.startTime && f.endTime && f.endTime < f.startTime
              ? addDays(f.startDate, 1)
              : f.startDate,
          time: v(f.endTime),
          place: v(f.to),
          coords: v(f.to) ? f.toCoords : undefined,
          address: v(f.to) ? f.toAddress : undefined,
        })
      : undefined;
  const carReturn =
    kind === 'car' && (v(f.to) || f.endDate || v(f.endTime))
      ? clean({
          date: f.endDate || f.startDate,
          time: v(f.endTime),
          place: v(f.to),
          coords: v(f.to) ? f.toCoords : undefined,
        })
      : undefined;
  return clean({
    ...common,
    title: carTitle ?? f.title.trim(),
    provider: v(f.provider),
    start: clean({
      date: f.startDate,
      time: v(f.startTime),
      place: v(f.from),
      coords:
        kind === 'tour'
          ? v(f.meetingPoint)
            ? f.meetCoords
            : undefined
          : (placed && v(f.from)) || PICK_KINDS.has(kind)
            ? f.fromCoords
            : undefined,
      address: kind === 'train' && v(f.from) ? f.fromAddress : undefined,
    }),
    end: carReturn ?? trainArrive,
    details: cleanOrUndefined({
      seat: kind === 'train' ? v(f.seat) : undefined,
      partySize: PARTY_KINDS.has(kind) ? party : undefined,
      phone: kind === 'tour' || kind === 'car' ? v(f.phone) : undefined,
      meetingPoint: kind === 'tour' ? v(f.meetingPoint) : undefined,
      insurance: kind === 'car' ? v(f.insurance) : undefined,
      carModel: kind === 'car' ? v(f.carModel) : undefined,
      plate: kind === 'car' ? v(f.plate)?.toUpperCase() : undefined,
      ...extras,
    }),
    priceNote: v(f.priceNote),
  });
}
