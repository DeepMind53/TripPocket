import { currentItemId, dayText, tightGap } from './dayTools';

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
