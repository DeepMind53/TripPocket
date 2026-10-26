import { describe, expect, it } from 'vitest';
import {
  alertQuery,
  notableAlerts,
  pointsByCountry,
  topAlertLevel,
  WEATHER_WARNING_LINKS,
  warningLinkFor,
  type DestinationAlert,
} from './alerts';
import { COUNTRY_ESSENTIALS } from '../data/essentials';

describe('나라별 특보 링크', () => {
  it('입국 정보가 있는 나라는 모두 그 나라 기상청 링크가 있다', () => {
    const codes = COUNTRY_ESSENTIALS.flatMap((c) => c.codes);
    for (const c of [...codes, 'KR']) expect(WEATHER_WARNING_LINKS[c], c).toBeDefined();
  });
  it('모르는 나라는 WMO로', () => {
    expect(warningLinkFor('ZZ').url).toContain('severeweather.wmo.int');
  });
});

describe('특보 묻기·고르기', () => {
  it('나라 코드와 일본·미국·캐나다 목적지 좌표(약 10km), 같은 값은 하나로, 나라마다 3곳', () => {
    const jp = (lat: number, lng: number) => ({ countryCode: 'JP', coords: { lat, lng } });
    expect(
      alertQuery({
        destinations: [
          jp(35.6895, 139.6917),
          jp(35.69, 139.7),
          { countryCode: 'TW', coords: { lat: 25.03, lng: 121.56 } },
          jp(34.69, 135.5),
          jp(43.06, 141.35),
          jp(33.59, 130.4),
          { countryCode: 'JP' },
        ],
      }),
    ).toEqual({
      countries: ['JP', 'TW'],
      points: ['JP:35.7:139.7', 'JP:34.7:135.5', 'JP:43.1:141.4'],
    });
    expect(pointsByCountry(['JP:35.7:139.7', 'US:40.7:-74'])).toEqual(
      new Map([
        ['JP', [[35.7, 139.7]]],
        ['US', [[40.7, -74]]],
      ]),
    );
  });

  it('빨강·주황만, 외교부 상시 단계는 빼고 특별여행주의보는 넣는다', () => {
    const a = (o: Partial<DestinationAlert>): DestinationAlert => ({
      id: 'x',
      country: 'JP',
      kind: 'weather',
      level: 'info',
      title: 't',
      source: 'jma',
      url: 'u',
      ...o,
    });
    const list = [
      a({ id: '1' }),
      a({ id: '2', level: 'red', source: 'mofa', kind: 'travel', step: 3 }),
      a({ id: '3', level: 'orange' }),
      a({ id: '4', level: 'red', source: 'mofa', kind: 'travel', special: 'evacuate' }),
    ];
    expect(notableAlerts(list).map((x) => x.id)).toEqual(['3', '4']);
    expect(topAlertLevel(notableAlerts(list))).toBe('red');
    expect(topAlertLevel([])).toBeNull();
  });
});
