import { nightsBetween } from '@trippocket/shared';

/**
 * 숙소 최저가 (docs/28 §4.1·§12.1): 숙소 이름·날짜·인원 → 예약 앱 검색 주소.
 * 웹에서 만들기만 한다 (서버 요청 0, 오프라인 가능). 가격은 사용자가 눌러서 각 앱에서 본다
 */
export interface StayQuery {
  name: string;
  /** YYYY-MM-DD */
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
}

/** 링크 버튼 순서 (Q2 확정: 6개 모두) */
export const LODGING_APPS = ['yeogi', 'nol', 'agoda', 'tripcom', 'booking', 'google'] as const;
export type LodgingApp = (typeof LODGING_APPS)[number];

export interface AppLink {
  app: LodgingApp;
  url: string;
  /** 주소에 날짜가 들어간다 (없으면 "날짜는 앱에서 골라요") */
  dates: boolean;
  /** 검색어를 주소로 못 넣는 앱: 열면서 숙소 이름을 복사해 붙여 넣게 한다 */
  copyName: boolean;
}

export const STAY_LIMITS = { nameMax: 80, nightsMax: 30, adultsMax: 8, roomsMax: 4 } as const;

export type StayQueryError = 'name' | 'dates' | 'tooLong';

/** 검색 전에 입력 검사 — 문제가 없으면 null */
export function stayQueryError(q: StayQuery): StayQueryError | null {
  const name = q.name.trim();
  if (!name || name.length > STAY_LIMITS.nameMax) return 'name';
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(q.checkIn) || !ymd.test(q.checkOut) || q.checkOut <= q.checkIn) return 'dates';
  if (nightsBetween(q.checkIn, q.checkOut) > STAY_LIMITS.nightsMax) return 'tooLong';
  return null;
}

/**
 * 앱별 검색 주소 (2026-11-09 점검, docs/28 §12.1). 아고다는 이름만으로 여는 검색 주소가 첫 화면으로 돌아가
 * 첫 화면을 열고 이름을 복사한다 — 숙소 링크가 있으면 화면에서 경로 링크(agodaRoutes)로 바꾼다.
 * 여기어때는 국내·해외 주소가 다르다: 해외 검색 주소는 여기어때 도시 번호가 꼭 있어야 해서(이름만이면 404)
 * 해외는 첫 화면을 열고 이름을 복사한다 (사용자 제보 2026-11-09: 대만 숙소에 한국 숙소가 나옴)
 */
export function appLinks(q: StayQuery, opts: { domestic: boolean }): AppLink[] {
  const name = encodeURIComponent(q.name.trim());
  const slash = (d: string) => d.replaceAll('-', '/');
  return [
    opts.domestic
      ? {
          app: 'yeogi',
          url: `https://www.yeogi.com/domestic-accommodations?keyword=${name}&checkIn=${q.checkIn}&checkOut=${q.checkOut}&personal=${q.adults}`,
          dates: true,
          copyName: false,
        }
      : { app: 'yeogi', url: 'https://www.yeogi.com/', dates: false, copyName: true },
    { app: 'nol', url: 'https://nol.yanolja.com/search?tab=place', dates: false, copyName: true },
    { app: 'agoda', url: 'https://www.agoda.com/ko-kr/', dates: false, copyName: true },
    {
      app: 'tripcom',
      // 날짜 칸 이름이 자료마다 달라(checkIn=YYYY-MM-DD · checkin=YYYY/MM/DD) 둘 다 넣는다 (2026-11-09 제보)
      url: `https://kr.trip.com/hotels/list?keyword=${name}&checkIn=${q.checkIn}&checkOut=${q.checkOut}&checkin=${slash(q.checkIn)}&checkout=${slash(q.checkOut)}&adult=${q.adults}&crn=${q.rooms}`,
      dates: true,
      copyName: false,
    },
    {
      app: 'booking',
      url: `https://www.booking.com/searchresults.ko.html?ss=${name}&checkin=${q.checkIn}&checkout=${q.checkOut}&group_adults=${q.adults}&no_rooms=${q.rooms}`,
      dates: true,
      copyName: false,
    },
    // 날짜 칸(ts)은 공개되지 않은 형식이라 이름만 (사용자 휴대폰 확인 2026-11-09)
    {
      app: 'google',
      url: `https://www.google.com/travel/search?q=${name}&hl=ko&gl=kr`,
      dates: false,
      copyName: false,
    },
  ];
}
