import { isDomesticTrip, tripCenter, tripCountries, lodgingArea } from './tripPlace';

describe('여행 장소 기준', () => {
  it('국가 코드로 국내/해외를 판단하고, 모르면 시간대로', () => {
    expect(
      isDomesticTrip({
        destinations: [{ name: '제주', kind: 'city', countryCode: 'KR' }],
        timezone: 'Asia/Seoul',
      }),
    ).toBe(true);
    expect(
      isDomesticTrip({
        destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
        timezone: 'Asia/Seoul',
      }),
    ).toBe(false);
    expect(
      isDomesticTrip({
        destinations: [{ name: '우리 동네', kind: 'custom' }],
        timezone: 'Asia/Seoul',
      }),
    ).toBe(true);
  });

  it('지도 중심과 국가 목록', () => {
    const trip = {
      destinations: [
        { name: '직접', kind: 'custom' as const },
        {
          name: '도쿄',
          kind: 'city' as const,
          countryCode: 'JP',
          coords: { lat: 35.68, lng: 139.69 },
        },
        {
          name: '오사카',
          kind: 'city' as const,
          countryCode: 'JP',
          coords: { lat: 34.69, lng: 135.5 },
        },
      ],
    };
    expect(tripCenter(trip)).toEqual({ lat: 35.68, lng: 139.69 });
    expect(tripCountries(trip)).toEqual(['JP']);
  });
});

describe('lodgingArea', () => {
  const city = { name: '푸껫', kind: 'city' as const, coords: { lat: 7.9, lng: 98.4 } };
  const other = { name: '방콕', kind: 'city' as const };
  it('목적지가 하나면 그 도시와 좌표', () => {
    expect(lodgingArea({ destinations: [city] })).toEqual({ area: '푸껫', areaAt: city.coords });
  });
  it('여럿이면 주소에 이름이 나오는 곳, 모르면 null', () => {
    expect(lodgingArea({ destinations: [other, city] }, '태국 푸껫 빠통')?.area).toBe('푸껫');
    expect(lodgingArea({ destinations: [other, city] })).toBeNull();
  });
  it('나라는 좌표를 쓰지 않는다', () => {
    const country = { name: '태국', kind: 'country' as const, coords: { lat: 15, lng: 101 } };
    expect(lodgingArea({ destinations: [country] })).toEqual({ area: '태국' });
  });
});
