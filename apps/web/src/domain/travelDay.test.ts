import { dayPhase, leaveAt, leaveInSeconds, legOptions, pickLegMode, rainFrom } from './travelDay';

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

describe('다음 일정 출발 (2026-11-10)', () => {
  it('남은 초 = 시작 − 이동 − 여유 10분 − 지금', () => {
    // 14:00 시작, 도보 30분 → 13:20 출발, 지금 11:51:22 → 88분 38초
    expect(leaveInSeconds('14:00', 11 * 3600 + 51 * 60 + 22, 30)).toBe(88 * 60 + 38);
    expect(leaveInSeconds('14:00', 13 * 3600 + 30 * 60, 30)).toBeLessThan(0);
  });

  it('조회 결과 → 도보·대중교통, 도보가 없거나 실패하면 직선거리 어림', () => {
    expect(legOptions({ walk: 25, transit: 9 }, 30)).toEqual({
      walk: { min: 25, straight: false },
      transit: 9,
    });
    expect(legOptions({ transit: 9 }, 30)).toEqual({
      walk: { min: 30, straight: true },
      transit: 9,
    });
    expect(legOptions(null, 30)).toEqual({ walk: { min: 30, straight: true } });
    expect(legOptions(null, undefined)).toEqual({});
  });

  it('고른 수단이 없으면 대중교통 먼저, 대중교통이 없으면 저절로 도보', () => {
    expect(pickLegMode({ walk: 1, transit: 2 }, null)).toBe('transit');
    expect(pickLegMode({ walk: 1, transit: 2 }, 'walk')).toBe('walk');
    expect(pickLegMode({ walk: 1 }, 'transit')).toBe('walk');
    expect(pickLegMode({}, null)).toBeNull();
  });
});
