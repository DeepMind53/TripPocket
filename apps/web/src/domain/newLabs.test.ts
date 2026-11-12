import { describe, expect, it } from 'vitest';
import { arrowDeg, bearingDeg } from './compass';
import { freeGapMin, splitHM } from './freeTime';
import { tripStoryText } from './tripStory';

describe('일정 사이 빈 시간', () => {
  it('끝 시각 → 다음 시작이 90분 이상일 때만', () => {
    expect(freeGapMin({ endTime: '12:00' }, { startTime: '14:30' })).toBe(150);
    expect(freeGapMin({ endTime: '12:00' }, { startTime: '13:00' })).toBeNull();
    // 끝 시각이 없으면 모른다
    expect(freeGapMin({}, { startTime: '18:00' })).toBeNull();
    expect(freeGapMin({ endTime: '12:00' }, undefined)).toBeNull();
    // 자정을 넘는 일정은 세지 않는다
    expect(freeGapMin({ endTime: '23:00' }, { startTime: '01:00' })).toBeNull();
    expect(splitHM(150)).toEqual({ h: 2, m: 30 });
  });
});

describe('숙소 방향', () => {
  it('북·동·남·서 방위각과 화살표 각도', () => {
    const o = { lat: 35, lng: 139 };
    expect(Math.round(bearingDeg(o, { lat: 36, lng: 139 }))).toBe(0);
    expect(Math.round(bearingDeg(o, { lat: 35, lng: 140 }))).toBe(90);
    expect(Math.round(bearingDeg(o, { lat: 34, lng: 139 }))).toBe(180);
    expect(Math.round(bearingDeg(o, { lat: 35, lng: 138 }))).toBe(270);
    // 휴대폰이 동쪽(90°)을 보고 숙소가 북쪽이면 화살표는 왼쪽(270°)
    expect(arrowDeg(0, 90)).toBe(270);
  });
});

describe('여행기 글', () => {
  it('날짜별 간 곳(시간 순) + 한 줄 기록, 건너뛴 곳·Plan B·빈 날은 뺀다', () => {
    const text = tripStoryText(
      {
        title: '도쿄 여행',
        startDate: '2026-10-27',
        endDate: '2026-10-29',
        destinations: [{ name: '도쿄' }] as never,
        dayNotes: [{ date: '2026-10-29', text: '야경이 예뻤어요' }],
      },
      [
        { date: '2026-10-27', order: 'b', title: '이치란', startTime: '18:30' },
        { date: '2026-10-27', order: 'a', title: '센소지', startTime: '10:00' },
        { date: '2026-10-27', order: 'c', title: '안 간 곳', visit: 'skipped' },
        { date: '2026-10-27', order: 'd', title: '비 오면', planId: 'p1' },
        { date: null, order: 'e', title: '가고 싶은 곳' },
      ],
      { dayN: (n) => `${n}일차`, note: '한 줄' },
    );
    expect(text).toBe(
      [
        '도쿄 여행 (2026.10.27 – 10.29)',
        '도쿄',
        '',
        '10.27 1일차',
        '- 10:00 센소지',
        '- 18:30 이치란',
        '',
        '10.29 3일차',
        '한 줄: 야경이 예뻤어요',
      ].join('\n'),
    );
  });
});
