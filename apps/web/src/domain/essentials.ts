import {
  COMMON_ESSENTIALS,
  daysUntil,
  essentialKey,
  essentialsFor,
  getTripDays,
  passportNeededUntil,
  type Booking,
  type CountryEssentials,
  type EssentialItem,
  type LocalDate,
  type Trip,
} from '@trippocket/shared';

/** 공통 항목의 나라 자리 키 */
export const COMMON_KEY = 'ALL';

export interface EssentialRow {
  key: string;
  item: EssentialItem;
  /** 체크됨 (직접 또는 자동) */
  checked: boolean;
  /** 앱이 판단해 체크함 */
  auto: boolean;
  /** 자동 판단 설명 (예: "무비자 90일 · 여행 4일") */
  note?: string;
  /** 주의 (예: 여권이 모자람) */
  warn?: string;
  /** 낼 수 있는 기간이 시작됐는데 아직 안 함 */
  due: boolean;
}

export interface EssentialGroup {
  /** 나라 코드 또는 COMMON_KEY */
  code: string;
  country: CountryEssentials | null;
  rows: EssentialRow[];
}

export interface EssentialsSummary {
  groups: EssentialGroup[];
  /** 체크할 수 있는 항목(필수·권장) 중 끝난 수 / 전체 */
  done: number;
  total: number;
  /** 아직 안 한 가장 급한 필수 항목 */
  next?: EssentialRow;
  /** 지금 해야 하는 항목이 있음 (홈 주황 점) */
  alert: boolean;
  /** 데이터가 없는 나라 (외교부 링크로 안내) */
  unknown: string[];
}

/** 체크 칸이 있는 항목 (팁은 읽기만) */
export const isCheckable = (i: EssentialItem) => i.level !== 'tip';

/**
 * 여행의 나라별 필수 항목 + 자동 판단 (docs/19).
 * checked = 사용자가 체크한 키 집합, passportExpiry = 이 기기에만 저장한 여권 만료일
 */
export function buildEssentials(input: {
  trip: Trip;
  bookings: readonly Booking[];
  checked: ReadonlySet<string>;
  passportExpiry: LocalDate | null;
  today: LocalDate;
}): EssentialsSummary {
  const { trip, bookings, checked, passportExpiry, today } = input;
  const live = bookings.filter((b) => !b.deletedAt);
  const codes = [
    ...new Set(trip.destinations.flatMap((d) => (d.countryCode ? [d.countryCode] : []))),
  ].filter((c) => c !== 'KR');
  const known = codes.flatMap((c) => {
    const data = essentialsFor(c);
    return data ? [{ code: c, data }] : [];
  });
  // 괌·사이판처럼 같은 묶음은 한 번만
  const seen = new Set<CountryEssentials>();
  const countries = known.filter(({ data }) => (seen.has(data) ? false : (seen.add(data), true)));
  const unknown = codes.filter((c) => !essentialsFor(c));
  const tripDays = getTripDays(trip.startDate, trip.endDate).length;
  const left = daysUntil(trip.startDate, today);

  const judge = (
    code: string,
    country: CountryEssentials | null,
    item: EssentialItem,
  ): EssentialRow => {
    const key = essentialKey(code, item.id);
    let auto = false;
    let note: string | undefined;
    let warn: string | undefined;
    switch (item.auto) {
      case 'visaFree':
        if (country?.visaFreeDays && tripDays <= country.visaFreeDays) {
          auto = true;
          note = `무비자 ${country.visaFreeDays}일 · 여행 ${tripDays}일 — 비자 필요 없음`;
        } else if (country?.visaFreeDays)
          warn = `여행이 ${tripDays}일이라 무비자 ${country.visaFreeDays}일보다 길어요`;
        break;
      case 'passport': {
        const until = passportNeededUntil(trip.endDate, country?.passportMonths ?? 'stay');
        if (passportExpiry) {
          if (passportExpiry >= until) {
            auto = true;
            note = `여권 만료 ${passportExpiry} — ${until}까지 필요, 충분해요`;
          } else warn = `여권이 ${until}까지는 남아야 해요 (만료 ${passportExpiry})`;
        } else note = `${until}까지 유효해야 해요`;
        break;
      }
      case 'transfer':
        if (live.some((b) => b.kind === 'transfer' || b.kind === 'car')) {
          auto = true;
          note = '픽업·드랍·렌터카 예약이 있어요';
        }
        break;
      case 'checkin': {
        const stay = live.find((b) => b.kind === 'lodging' && b.start.time);
        if (stay) {
          auto = true;
          note = `${stay.title} 체크인 ${stay.start.time}`;
        }
        break;
      }
      case 'returnFlight':
        if (live.some((b) => b.kind === 'flight' && b.start.date > trip.startDate)) {
          auto = true;
          note = '돌아오는 항공 예약이 있어요';
        }
        break;
    }
    const isChecked = auto || checked.has(key);
    const due =
      !isChecked &&
      item.level === 'must' &&
      item.fromDaysBefore !== undefined &&
      left >= 0 &&
      left <= item.fromDaysBefore;
    return {
      key,
      item,
      checked: isChecked,
      auto,
      ...(note ? { note } : {}),
      ...(warn ? { warn } : {}),
      due,
    };
  };

  const groups: EssentialGroup[] = countries.map(({ code, data }) => ({
    code,
    country: data,
    rows: data.items.map((i) => judge(code, data, i)),
  }));
  if (countries.length > 0 || unknown.length > 0)
    groups.push({
      code: COMMON_KEY,
      country: null,
      rows: COMMON_ESSENTIALS.map((i) => judge(COMMON_KEY, null, i)),
    });

  const checkable = groups.flatMap((g) => g.rows).filter((r) => isCheckable(r.item));
  const order = { must: 0, recommend: 1, tip: 2 } as const;
  const pending = checkable
    .filter((r) => !r.checked)
    .sort((a, b) => Number(b.due) - Number(a.due) || order[a.item.level] - order[b.item.level]);
  return {
    groups,
    done: checkable.filter((r) => r.checked).length,
    total: checkable.length,
    ...(pending[0] ? { next: pending[0] } : {}),
    alert: checkable.some((r) => r.due || (!!r.warn && r.item.level === 'must')),
    unknown,
  };
}
