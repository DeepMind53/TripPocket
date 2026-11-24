import {
  currentItemId,
  dayText,
  isFlightLeg,
  nextStop,
  pastItemIds,
  visitableItemIds,
} from './dayTools';

it('하루 일정 글: 제목 줄 + 번호·시각·이름·주소, 메모는 첫 줄', () => {
  expect(
    dayText(
      '1일차 · 10.24 (토)',
      [
        {
          kind: 'place',
          title: '센소지',
          startTime: '10:00',
          place: { name: '센소지', address: '도쿄 다이토구' },
        },
        { kind: 'note', title: '환전', memo: '환전하기\n공항에서' },
        { kind: 'food', title: '이치란' },
      ],
      (t) => t ?? null,
    ),
  ).toBe('1일차 · 10.24 (토)\n1. 10:00 센소지 (도쿄 다이토구)\n2. 환전하기\n3. 이치란');
});

describe('currentItemId', () => {
  const items = [
    { id: 'a', startTime: '09:00' },
    { id: 'memo' },
    { id: 'b', startTime: '11:30', endTime: '12:30' },
    { id: 'c', startTime: '14:00' },
  ];

  it('runs until the next item starts', () => {
    expect(currentItemId(items, '10:59')).toBe('a');
  });

  it('uses the end time when written', () => {
    expect(currentItemId(items, '12:00')).toBe('b');
    expect(currentItemId(items, '13:00')).toBeNull();
  });

  it('keeps the last item for two hours', () => {
    expect(currentItemId(items, '15:59')).toBe('c');
    expect(currentItemId(items, '16:00')).toBeNull();
  });

  it('is empty before the first item', () => {
    expect(currentItemId(items, '08:00')).toBeNull();
  });
});

describe('pastItemIds', () => {
  const items = [
    { id: 'y', date: '2026-10-24' },
    { id: 'a', date: '2026-10-25', startTime: '09:00' },
    { id: 'b', date: '2026-10-25', startTime: '11:00', endTime: '12:00' },
    { id: 'memo', date: '2026-10-25' },
    { id: 'tomorrow', date: '2026-10-26', startTime: '09:00' },
    { id: 'wish', date: null },
  ];

  it('지난 날은 모두, 오늘은 끝난 일정만', () => {
    expect([...pastItemIds(items, '2026-10-25', '11:30')].sort()).toEqual(['a', 'y']);
    expect([...pastItemIds(items, '2026-10-25', '12:00')].sort()).toEqual(['a', 'b', 'y']);
  });

  it('메모는 방문 기록 대상이 아니다', () => {
    expect([
      ...pastItemIds([{ id: 'n', date: '2026-10-24', kind: 'note' }], '2026-10-25', '08:00'),
    ]).toEqual([]);
  });

  it('하루가 지나면 시각 없는 일정도', () => {
    expect([...pastItemIds(items, '2026-10-26', '08:00')].sort()).toEqual(['a', 'b', 'memo', 'y']);
  });
});

describe('visitableItemIds', () => {
  const items = [
    { id: 'y', date: '2026-10-25' },
    { id: 'a', date: '2026-10-26', startTime: '09:00' },
    { id: 'free', date: '2026-10-26' },
    { id: 'memo', date: '2026-10-26', kind: 'note' as const },
    { id: 'b', date: '2026-10-26', startTime: '11:00', endTime: '12:00' },
    { id: 'c', date: '2026-10-26', startTime: '14:00' },
  ];

  it('지금 진행 중인 일정과 그 앞 일정(시각 없는 것 포함)까지, 메모는 빼고', () => {
    expect([...visitableItemIds(items, '2026-10-26', '11:30')].sort()).toEqual([
      'a',
      'b',
      'free',
      'y',
    ]);
  });

  it('진행 중인 일정이 없으면 지난 일정과 그 앞 일정까지', () => {
    expect([...visitableItemIds(items, '2026-10-26', '08:00')].sort()).toEqual(['y']);
    expect([...visitableItemIds(items, '2026-10-26', '13:00')].sort()).toEqual([
      'a',
      'b',
      'free',
      'y',
    ]);
  });
});

describe('isFlightLeg', () => {
  it('항공 출발 일정이면 다음 구간은 비행', () => {
    expect(isFlightLeg({ transport: { mode: 'flight' } })).toBe(true);
    expect(isFlightLeg({ transport: { mode: 'walk' } })).toBe(false);
    expect(isFlightLeg({})).toBe(false);
  });
});

describe('nextStop', () => {
  const items = [
    { id: 'a', kind: 'place' as const, startTime: '09:00' },
    { id: 'm', kind: 'note' as const, startTime: '13:00' },
    { id: 'c', kind: 'cafe' as const, startTime: '15:00' },
    { id: 'b', kind: 'food' as const, startTime: '13:30' },
    { id: 'x', kind: 'place' as const },
  ];

  it('지금 뒤 첫 일정 (메모·시각 없는 것 빼고)', () => {
    expect(nextStop(items, '12:00')?.id).toBe('b');
    expect(nextStop(items, '16:00')).toBeNull();
  });
});
