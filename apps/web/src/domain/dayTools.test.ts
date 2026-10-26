import { currentItemId, dayText, isFlightLeg, leaveAt, pastItemIds, tightGap } from './dayTools';

const at = (lat: number, lng: number) => ({ name: 'p', coords: { lat, lng } });

describe('빠듯한 일정 (실험실)', () => {
  it('걸어서 걸리는 시간이 시각 차이보다 길면 알려 준다', () => {
    // 약 2.2km → 걸어서 30분 넘게
    const r = tightGap(
      { startTime: '10:00', place: at(35.68, 139.69) },
      { startTime: '10:15', place: at(35.7, 139.69) },
    );
    expect(r).not.toBeNull();
    expect(r!.gap).toBe(15);
    expect(r!.walk).toBeGreaterThan(15);
  });

  it('끝나는 시각이 있으면 그때부터 · 여유 있거나 시각·좌표가 없으면 null', () => {
    const near = { place: at(35.68, 139.69) };
    const far = { place: at(35.7, 139.69) };
    expect(tightGap({ ...near, startTime: '10:00' }, { ...far, startTime: '12:00' })).toBeNull();
    expect(
      tightGap({ ...near, startTime: '10:00', endTime: '11:50' }, { ...far, startTime: '12:00' }),
    ).toMatchObject({ gap: 10 });
    expect(tightGap({ ...near }, { ...far, startTime: '12:00' })).toBeNull();
    expect(tightGap({ startTime: '10:00' }, { ...far, startTime: '10:05' })).toBeNull();
    expect(tightGap({ ...near, startTime: '10:00' }, undefined)).toBeNull();
  });
});

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

  it('하루가 지나면 시각 없는 일정도', () => {
    expect([...pastItemIds(items, '2026-10-26', '08:00')].sort()).toEqual(['a', 'b', 'memo', 'y']);
  });
});

describe('leaveAt', () => {
  it('걸어서 20분 안이면 도보 기준', () => {
    expect(leaveAt('14:00', { walk: 15, transit: 10 })).toBe('13:45');
  });

  it('멀면 대중교통 기준, 없으면 도보', () => {
    expect(leaveAt('14:00', { walk: 50, transit: 25 })).toBe('13:35');
    expect(leaveAt('14:00', { walk: 50 })).toBe('13:10');
  });

  it('다음 일정 시각이 없거나 시간을 모르면 null', () => {
    expect(leaveAt(undefined, { walk: 10 })).toBeNull();
    expect(leaveAt('14:00', {})).toBeNull();
  });

  it('자정 전으로 넘어가지 않는다', () => {
    expect(leaveAt('00:10', { walk: 15 })).toBe('00:00');
  });
});

describe('isFlightLeg', () => {
  it('항공 출발 다음 구간은 빠듯함을 따지지 않는다', () => {
    const flight = {
      startTime: '06:30',
      transport: { mode: 'flight' as const },
      place: { coords: { lat: 37.46, lng: 126.44 } },
    };
    const arrive = { startTime: '08:50', place: { coords: { lat: 35.77, lng: 140.39 } } };
    expect(isFlightLeg(flight)).toBe(true);
    expect(tightGap(flight, arrive)).toBeNull();
  });
});
