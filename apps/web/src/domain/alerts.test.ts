import type { DestinationAlert } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { alertQuery, notableAlerts, topLevel } from './alerts';

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

describe('여행지 특보', () => {
  it('나라 코드와 일본·미국·캐나다 목적지 좌표(약 10km)만', () => {
    expect(
      alertQuery({
        destinations: [
          {
            name: '도쿄',
            kind: 'city',
            countryCode: 'JP',
            coords: { lat: 35.6895, lng: 139.6917 },
          },
          {
            name: '타이베이',
            kind: 'city',
            countryCode: 'TW',
            coords: { lat: 25.03, lng: 121.56 },
          },
          { name: '오사카', kind: 'city', countryCode: 'JP' },
        ],
      }),
    ).toEqual({ countries: ['JP', 'TW'], points: ['JP:35.7:139.7'] });
  });

  it('홈 점: 빨강·주황만, 외교부 상시 단계는 빼고 특별여행주의보는 넣는다', () => {
    const list = [
      a({ id: '1', level: 'info' }),
      a({ id: '2', level: 'red', source: 'mofa', kind: 'travel', step: 3 }),
      a({ id: '3', level: 'orange' }),
      a({ id: '4', level: 'red', source: 'mofa', kind: 'travel', special: 'evacuate' }),
    ];
    expect(notableAlerts(list).map((x) => x.id)).toEqual(['3', '4']);
    expect(topLevel(notableAlerts(list))).toBe('red');
    expect(topLevel([a({ level: 'orange' })])).toBe('orange');
    expect(topLevel([])).toBeNull();
  });
});
