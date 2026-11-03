import { dayPhase, leaveAt, rainFrom } from './travelDay';

const it2 = (startTime?: string, endTime?: string) => ({
  kind: 'place' as const,
  ...(startTime ? { startTime } : {}),
  ...(endTime ? { endTime } : {}),
});

describe('여행 모드 하루 흐름 (docs/27)', () => {
  it('첫 일정 전 = 아침, 일정 중 = 낮, 모두 끝나면 = 저녁, 시각 없는 날 = 낮', () => {
    const day = [it2('09:00', '10:30'), it2('13:00')];
    expect(dayPhase(day, '07:30')).toBe('morning');
    expect(dayPhase(day, '09:10')).toBe('day');
    expect(dayPhase(day, '11:00')).toBe('day');
    expect(dayPhase(day, '13:59')).toBe('day');
    expect(dayPhase(day, '14:00')).toBe('evening');
    expect(dayPhase([it2()], '23:00')).toBe('day');
  });

  it('나갈 시각 = 시작 − 이동 − 여유 10분', () => {
    expect(leaveAt('15:00', '14:05', 18)).toEqual({ at: '14:32', inMin: 27 });
    expect(leaveAt('15:00', '14:55', undefined)).toEqual({ at: '14:50', inMin: -5 });
  });

  it('비가 오는 첫 시각 (시간별 → 시, 하루 예보만 → -1)', () => {
    const hours = { code: Array(24).fill(0) as number[], temp: Array(24).fill(15) as number[] };
    hours.code[16] = 61;
    expect(rainFrom({ code: 61, min: 10, max: 15, hours }, '14:10')).toBe(16);
    expect(rainFrom({ code: 61, min: 10, max: 15, hours }, '17:00')).toBeNull();
    expect(rainFrom({ code: 61, min: 10, max: 15 }, '09:00')).toBe(-1);
    expect(rainFrom({ code: 0, min: 10, max: 15 }, '09:00')).toBeNull();
  });
});
