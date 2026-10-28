import { describe, expect, it } from 'vitest';
import { hoursAhead, lateNightAt } from './travelExtras';
import { weatherCautions } from './weather';

describe('날씨 주의 (2026-10-28 정식)', () => {
  it('비·뇌우·눈·안개·쌀쌀함·영하·더위를 모두 모은다', () => {
    expect(weatherCautions({ code: 61, min: 8, max: 14 })).toEqual(['rain', 'cold']);
    expect(weatherCautions({ code: 0, min: 24, max: 33 })).toEqual(['hot']);
    expect(weatherCautions({ code: 73, min: -3, max: 2 })).toEqual(['snow', 'cold', 'freezing']);
    expect(weatherCautions({ code: 95, min: 22, max: 28 })).toEqual(['storm']);
    expect(weatherCautions({ code: 45, min: 15, max: 24 })).toEqual(['fog']);
    expect(weatherCautions({ code: 2, min: 15, max: 24 })).toEqual([]);
  });

  it('시차: 방콕은 한국보다 2시간 느리다', () => {
    expect(hoursAhead('Asia/Bangkok')).toBe(-2);
    expect(hoursAhead('Asia/Tokyo')).toBe(0);
  });
});

describe('늦은 귀가 안내 (2026-10-28 정식)', () => {
  it('22시 이후 시작·끝 시각 중 가장 늦은 것, 메모는 빼고', () => {
    expect(lateNightAt([{ kind: 'food', startTime: '20:00', endTime: '22:30' }])).toBe('22:30');
    expect(lateNightAt([{ kind: 'food', startTime: '21:00' }])).toBeNull();
    expect(lateNightAt([{ kind: 'note', startTime: '23:00' }])).toBeNull();
  });
});
