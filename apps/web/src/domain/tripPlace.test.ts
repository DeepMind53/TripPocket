import { isDomesticTrip, tripCenter, tripCountries } from './tripPlace';

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
