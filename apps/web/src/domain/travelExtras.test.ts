import { describe, expect, it } from 'vitest';
import { hoursAhead, lateNightAt } from './travelExtras';
import { weatherCautions, weatherCautionsAt } from './weather';

describe('날씨 주의 (2026-10-28 정식)', () => {
  it('비·뇌우·눈·안개·쌀쌀함·영하·더위를 모두 모은다', () => {
    expect(weatherCautions({ code: 61, min: 8, max: 14 })).toEqual(['rain', 'cold']);
    expect(weatherCautions({ code: 0, min: 24, max: 33 })).toEqual(['hot']);
    expect(weatherCautions({ code: 73, min: -3, max: 2 })).toEqual(['snow', 'cold', 'freezing']);
    expect(weatherCautions({ code: 95, min: 22, max: 28 })).toEqual(['storm']);
    expect(weatherCautions({ code: 45, min: 15, max: 24 })).toEqual(['fog']);
    expect(weatherCautions({ code: 2, min: 15, max: 24 })).toEqual([]);
    // 머리에 보이는 반올림 온도 기준: 10.4° → "10°" → 겉옷, 29.6° → "30°" → 더위
    expect(weatherCautions({ code: 2, min: 10.4, max: 29.6 })).toEqual(['cold', 'hot']);
  });

  it('일정 시각마다: 시간별 예보가 있으면 그 시각의 날씨·기온, 없으면 하루 예보', () => {
    const code = Array<number>(24).fill(0);
    const temp = Array<number>(24).fill(18);
    code[11] = 61; // 11시 비
    temp[6] = 9; // 6시 쌀쌀
    const day = { code: 61, min: 9, max: 18, hours: { code, temp } };
    expect(weatherCautionsAt(day, '11:00')).toEqual(['rain']);
    expect(weatherCautionsAt(day, '12:30')).toEqual([]);
    expect(weatherCautionsAt(day, '12:00')).toEqual([]);
    expect(weatherCautionsAt(day, '06:10')).toEqual(['cold']);
    // 10:30 시작이면 11시까지 걸친다 → 비, 끝 시각이 있으면 그때까지
    expect(weatherCautionsAt(day, '10:30')).toEqual(['rain']);
    expect(weatherCautionsAt(day, '09:00', '12:00')).toEqual(['rain']);
    expect(weatherCautionsAt(day, '12:00', '14:00')).toEqual([]);
    // 시각이 없거나 시간별이 없으면 하루 예보
    expect(weatherCautionsAt(day)).toEqual(['rain', 'cold']);
    expect(weatherCautionsAt({ code: 61, min: 9, max: 18 }, '12:00')).toEqual(['rain', 'cold']);
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
