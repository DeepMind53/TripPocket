import {
  findAirport,
  type Booking,
  type ItineraryItem,
  type LocalDate,
  type LocalTime,
} from '@trippocket/shared';

/** 일정표에 넣을 일정 (저장소 itemRepo.create 입력에서 tripId 제외) */
export interface PlanDraft {
  date: LocalDate;
  kind: ItineraryItem['kind'];
  title: string;
  startTime?: LocalTime;
  place?: NonNullable<ItineraryItem['place']>;
  transport?: NonNullable<ItineraryItem['transport']>;
  bookingId: string;
}

const KIND: Record<Booking['kind'], ItineraryItem['kind']> = {
  flight: 'transport',
  train: 'transport',
  car: 'transport',
  transfer: 'transport',
  lodging: 'lodging',
  restaurant: 'food',
  tour: 'activity',
  ticket: 'activity',
  other: 'place',
};

const MODE: Partial<Record<Booking['kind'], NonNullable<ItineraryItem['transport']>['mode']>> = {
  flight: 'flight',
  train: 'train',
  car: 'car',
  transfer: 'car',
};

/** 공항 코드 → 지도 핀이 있는 장소 (목록에 없는 공항은 이름만) */
function airportPlace(code: string | undefined): PlanDraft['place'] {
  if (!code) return undefined;
  const a = findAirport(code);
  if (!a) return { name: code };
  return { name: a.name, ...(a.coords ? { coords: a.coords, coordsSource: 'user' as const } : {}) };
}

const clip = (s: string) => s.slice(0, 100);

/**
 * 예약 → 일정표에 처음 한 번 넣을 일정 (사용자 요청 2026-10-26).
 * 항공: 출발 공항(탑승 시각) + 도착 공항(도착 시각) — 공항이 지도에 핀으로.
 * 숙소: 체크인 날·체크인 시각. 그 밖: 시작 날·시각
 */
export function planDraftsFromBooking(
  b: Booking,
  arriveLabel: (airport: string) => string,
): PlanDraft[] {
  const base = { bookingId: b.id };
  const time = (t: LocalTime | undefined) => (t ? { startTime: t } : {});
  if (b.kind === 'flight') {
    const from = airportPlace(b.start.place);
    const to = airportPlace(b.end?.place);
    const transport = {
      mode: 'flight' as const,
      ...(b.start.place ? { from: b.start.place } : {}),
      ...(b.end?.place ? { to: b.end.place } : {}),
    };
    const out: PlanDraft[] = [
      {
        ...base,
        date: b.start.date,
        kind: 'transport',
        title: b.title,
        ...time(b.start.time),
        ...(from ? { place: from } : {}),
        transport,
      },
    ];
    if (b.end && to) {
      out.push({
        ...base,
        date: b.end.date,
        kind: 'transport',
        title: clip(arriveLabel(to.name ?? b.end.place ?? '')),
        ...time(b.end.time),
        place: to,
      });
    }
    return out;
  }
  const mode = MODE[b.kind];
  const address = b.details?.address;
  const placeName = b.kind === 'lodging' || b.kind === 'restaurant' ? b.title : b.start.place;
  const place =
    placeName || address
      ? { ...(placeName ? { name: clip(placeName) } : {}), ...(address ? { address } : {}) }
      : undefined;
  return [
    {
      ...base,
      date: b.start.date,
      kind: KIND[b.kind],
      title: b.title,
      ...time(b.start.time),
      ...(place ? { place } : {}),
      ...(mode
        ? {
            transport: {
              mode,
              ...(b.start.place ? { from: b.start.place } : {}),
              ...(b.end?.place ? { to: b.end.place } : {}),
            },
          }
        : {}),
    },
  ];
}

/**
 * 그날 일정 사이에서 시각에 맞는 자리: 그보다 늦은 시각 일정 바로 앞, 없으면 맨 뒤.
 * 시간 없는 일정은 건너뛴다 (사용자가 놓은 자리를 존중)
 */
export function timeSlotIndex(
  dayItems: readonly Pick<ItineraryItem, 'startTime'>[],
  time: LocalTime | undefined,
): number {
  if (!time) return dayItems.length;
  const i = dayItems.findIndex((it) => it.startTime !== undefined && it.startTime > time);
  return i === -1 ? dayItems.length : i;
}

/** 아직 일정표에 넣지 않은 예약 (지운 예약·이미 연결된 일정이 있는 예약 제외) */
export function bookingsToPlan(
  bookings: readonly Booking[],
  items: readonly Pick<ItineraryItem, 'bookingId'>[],
): Booking[] {
  const linked = new Set(items.map((i) => i.bookingId).filter(Boolean));
  return bookings.filter((b) => !b.deletedAt && !b.plannedAt && !linked.has(b.id));
}

/** 공항 일정: 항공 이동(직접 넣은 것 포함)·항공 예약에서 들어온 도착 공항 */
export function isAirportStop(
  item: Pick<ItineraryItem, 'kind' | 'bookingId' | 'transport'>,
): boolean {
  if (item.kind !== 'transport') return false;
  if (item.transport) return item.transport.mode === 'flight';
  return item.bookingId !== undefined;
}

/**
 * 지도를 맞출 좌표: 공항은 핀만 보이고 범위에서 뺀다 — 인천~타이베이처럼 지도가 너무 멀리 빠지지 않게
 * (사용자 요청 2026-10-26). 공항만 있으면 공항으로 맞춘다
 */
export function fitPoints<T extends Pick<ItineraryItem, 'kind' | 'bookingId' | 'transport'>>(
  items: readonly T[],
): T[] {
  const rest = items.filter((i) => !isAirportStop(i));
  return rest.length > 0 ? rest : [...items];
}

/**
 * 예약을 고친 뒤 이미 일정표에 들어간 일정을 맞출 짝 (사용자 요청 2026-10-26).
 * 항공은 출발(이동 정보 있음)·도착 두 일정 — 이동 정보 유무로 짝짓고, 그 밖은 차례대로.
 * 사용자가 지운 일정은 짝이 없으면 다시 만들지 않는다
 */
export function pairDrafts<T extends Pick<ItineraryItem, 'transport'>>(
  linked: readonly T[],
  drafts: readonly PlanDraft[],
): { item: T; draft: PlanDraft }[] {
  const left = [...linked];
  const out: { item: T; draft: PlanDraft }[] = [];
  for (const draft of drafts) {
    const i = left.findIndex((it) => !!it.transport === !!draft.transport);
    if (i < 0) continue;
    out.push({ item: left[i]!, draft });
    left.splice(i, 1);
  }
  return out;
}

/**
 * 짝지은 일정에 예약 내용을 덮어쓸 값. 메모·다녀옴·방문 기록은 그대로,
 * 장소는 이름·주소가 같으면 사용자가 검색해 넣은 좌표를 살린다
 */
export function draftPatch(
  item: Pick<ItineraryItem, 'place'>,
  draft: PlanDraft,
): Pick<ItineraryItem, 'title' | 'startTime' | 'place' | 'transport'> {
  const same =
    item.place &&
    draft.place &&
    item.place.name === draft.place.name &&
    (draft.place.address === undefined || item.place.address === draft.place.address);
  return {
    title: draft.title,
    startTime: draft.startTime,
    place: same ? item.place : draft.place,
    transport: draft.transport,
  };
}
