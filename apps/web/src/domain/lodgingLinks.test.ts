import {
  AGODA_DEFAULT_CID,
  AGODA_PROMOS,
  AGODA_ROUTES,
  agodaRouteUrl,
  parseAgodaLink,
} from './agodaRoutes';
import { appLinks, LODGING_APPS, stayQueryError, type StayQuery } from './lodgingLinks';

const q: StayQuery = {
  name: '호텔 그레이스리 & 신주쿠',
  checkIn: '2026-11-24',
  checkOut: '2026-11-27',
  adults: 2,
  rooms: 1,
};

describe('숙소 최저가 링크 (docs/28 §4)', () => {
  it('입력 검사: 이름·날짜 순서·최대 30박', () => {
    expect(stayQueryError(q)).toBeNull();
    expect(stayQueryError({ ...q, name: '  ' })).toBe('name');
    expect(stayQueryError({ ...q, name: 'a'.repeat(81) })).toBe('name');
    expect(stayQueryError({ ...q, checkOut: q.checkIn })).toBe('dates');
    expect(stayQueryError({ ...q, checkOut: '' })).toBe('dates');
    expect(stayQueryError({ ...q, checkOut: '2026-12-25' })).toBe('tooLong');
  });

  it('앱 6개 순서대로, 이름은 주소에 맞게 바꾸고 날짜·인원을 넣는다', () => {
    const links = appLinks(q, { domestic: true });
    expect(links.map((l) => l.app)).toEqual([...LODGING_APPS]);
    const by = Object.fromEntries(links.map((l) => [l.app, l]));
    const name = encodeURIComponent(q.name);
    expect(by.tripcom!.url).toBe(
      `https://kr.trip.com/hotels/list?keyword=${name}&checkIn=2026-11-24&checkOut=2026-11-27&checkin=2026/11/24&checkout=2026/11/27&adult=2&crn=1`,
    );
    expect(by.booking!.url).toContain(
      `ss=${name}&checkin=2026-11-24&checkout=2026-11-27&group_adults=2&no_rooms=1`,
    );
    expect(by.yeogi!.url).toContain('checkIn=2026-11-24&checkOut=2026-11-27&personal=2');
    // 구글 호텔은 날짜를 못 넣고, NOL·아고다(첫 화면)는 이름을 복사해 연다
    expect(by.google).toMatchObject({ dates: false, copyName: false });
    expect(by.nol).toMatchObject({ dates: false, copyName: true });
    expect(by.agoda).toMatchObject({ dates: false, copyName: true });
    expect(links.every((l) => l.url.startsWith('https://'))).toBe(true);
  });

  it('해외 숙소: 여기어때는 국내 검색 주소를 쓰지 않고 이름을 복사해 연다 (대만 숙소에 한국 숙소가 나오던 문제)', () => {
    const yeogi = appLinks(q, { domestic: false }).find((l) => l.app === 'yeogi')!;
    expect(yeogi.url).not.toContain('domestic');
    expect(yeogi).toMatchObject({ dates: false, copyName: true });
  });

  it('아고다 경로 20개 + 할인 안내 17개, 경로 값은 겹치지 않는다', () => {
    expect(AGODA_ROUTES).toHaveLength(20);
    expect(new Set(AGODA_ROUTES.map((r) => r.cid)).size).toBe(20);
    expect(AGODA_ROUTES.filter((r) => r.group === 'search')).toHaveLength(7);
    expect(AGODA_ROUTES.filter((r) => r.group === 'card')).toHaveLength(10);
    expect(AGODA_ROUTES.filter((r) => r.group === 'airline')).toHaveLength(3);
    expect(AGODA_PROMOS).toHaveLength(17);
  });

  it('붙여 넣은 아고다 글에서 숙소 찾기: 숙소 id·숙소 화면 주소, 그 밖은 null', () => {
    expect(
      parseAgodaLink(
        '호텔 그레이스리 신주쿠 https://www.agoda.com/search?cid=1&selectedproperty=706347&city=5085 아고다에서 보기',
      ),
    ).toEqual({ hid: 706347 });
    expect(
      parseAgodaLink(
        'https://www.agoda.com/ko-kr/hotel-gracery-shinjuku/hotel/tokyo-jp.html?checkIn=2026-12-01&los=1&cid=1844104&tag=x',
      ),
    ).toEqual({ path: '/ko-kr/hotel-gracery-shinjuku/hotel/tokyo-jp.html' });
    expect(parseAgodaLink('https://www.agoda.com/ko-kr/')).toBeNull();
    expect(parseAgodaLink('https://agoda.com.evil.example/hotel/x.html')).toBeNull();
    expect(parseAgodaLink('https://www.booking.com/hotel/jp/x.html')).toBeNull();
    expect(parseAgodaLink('그레이스리')).toBeNull();
  });

  it('경로 링크: 숙소 id는 제휴 검색 주소, 숙소 화면은 날짜·인원·경로만 바꾸고 제휴 태그는 버린다', () => {
    expect(agodaRouteUrl({ hid: 706347 }, 1760133, q)).toBe(
      'https://www.agoda.com/partners/partnersearch.aspx?hid=706347&cid=1760133&checkin=2026-11-24&checkout=2026-11-27&NumberofAdults=2&Rooms=1',
    );
    expect(
      agodaRouteUrl(
        { path: '/ko-kr/hotel-gracery-shinjuku/hotel/tokyo-jp.html' },
        AGODA_DEFAULT_CID,
        q,
      ),
    ).toBe(
      'https://www.agoda.com/ko-kr/hotel-gracery-shinjuku/hotel/tokyo-jp.html?checkIn=2026-11-24&los=3&adults=2&rooms=1&cid=-1',
    );
  });
});
