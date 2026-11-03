import { describe, expect, it } from 'vitest';
import { airWarnings, dailyAir } from './air';

describe('미세먼지·자외선', () => {
  it('시간별 → 하루 평균 PM2.5·최고 자외선', () => {
    expect(
      dailyAir(
        ['2026-11-03T00:00', '2026-11-03T12:00', '2026-11-04T12:00', 'x'],
        [30, 50, null, 99],
        [0, 8.6, 3, 99],
      ),
    ).toEqual({ '2026-11-03': { pm25: 40, uv: 9 }, '2026-11-04': { uv: 3 } });
  });

  it('나쁨 이상·매우 높음 이상만 알린다', () => {
    expect(airWarnings({ pm25: 35, uv: 7 })).toEqual([]);
    expect(airWarnings({ pm25: 40, uv: 9 })).toEqual([
      { key: 'pm25Bad', v: 40 },
      { key: 'uvVeryHigh', v: 9 },
    ]);
    expect(airWarnings({ pm25: 80, uv: 11 }).map((w) => w.key)).toEqual([
      'pm25VeryBad',
      'uvExtreme',
    ]);
    expect(airWarnings(undefined)).toEqual([]);
  });
});

describe('국내 시도 (에어코리아)', () => {
  it('도시 이름으로 시도를 찾는다', async () => {
    const { sidoOf } = await import('./sido');
    expect(sidoOf('강릉')).toBe('강원');
    expect(sidoOf('제주 서귀포')).toBe('제주');
    expect(sidoOf('경기 광주')).toBe('경기');
    expect(sidoOf('도쿄')).toBeNull();
  });
});
