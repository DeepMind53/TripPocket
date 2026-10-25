import type { ItineraryItem } from '@trippocket/shared';
import { planReflow, shortestOrder, sortByTimeKeepingUntimed } from './schedule';

const item = (id: string, date: string | null, startTime?: string): ItineraryItem => ({
  id,
  tripId: 't',
  date,
  order: 'V',
  kind: 'place',
  title: id,
  createdAt: '2026-10-22T00:00:00.000Z',
  updatedAt: '2026-10-22T00:00:00.000Z',
  ...(startTime ? { startTime } : {}),
});

describe('시간순 정렬', () => {
  it('시간 있는 일정만 시간 순서로, 시간 없는 일정은 제자리', () => {
    const list = [
      item('a', 'd', '14:00'),
      item('memo', 'd'),
      item('b', 'd', '09:00'),
      item('c', 'd', '11:30'),
    ];
    expect(sortByTimeKeepingUntimed(list)).toEqual(['b', 'memo', 'c', 'a']);
  });

  it('시간이 하나도 없으면 그대로', () => {
    expect(sortByTimeKeepingUntimed([item('x', 'd'), item('y', 'd')])).toEqual(['x', 'y']);
  });
});

describe('기간 변경', () => {
  // 원래 10.24 ~ 10.28 (5일)
  const items = [
    item('d1', '2026-10-24'),
    item('d3', '2026-10-26'),
    item('d5', '2026-10-28'),
    item('wish', null),
  ];

  it('일차 유지: 출발을 하루 미루면 모든 날짜가 함께 밀린다', () => {
    const plan = planReflow(items, '2026-10-24', '2026-10-25', '2026-10-29', 'keepDayNumber');
    expect(plan.moves).toEqual([
      { id: 'd1', to: '2026-10-25' },
      { id: 'd3', to: '2026-10-27' },
      { id: 'd5', to: '2026-10-29' },
    ]);
    expect(plan).toMatchObject({ shifted: 3, toWishlist: 0 });
  });

  it('일차 유지: 여행을 줄이면 넘치는 일차는 가고 싶은 곳으로', () => {
    const plan = planReflow(items, '2026-10-24', '2026-10-24', '2026-10-26', 'keepDayNumber');
    expect(plan.moves).toEqual([{ id: 'd5', to: null }]);
    expect(plan.toWishlist).toBe(1);
  });

  it('날짜 유지: 새 기간 밖 일정만 가고 싶은 곳으로', () => {
    const plan = planReflow(items, '2026-10-24', '2026-10-25', '2026-10-29', 'keepDate');
    expect(plan.moves).toEqual([{ id: 'd1', to: null }]);
    expect(plan).toMatchObject({ shifted: 0, toWishlist: 1 });
  });

  it('바뀌는 게 없으면 빈 계획', () => {
    expect(planReflow(items, '2026-10-24', '2026-10-24', '2026-10-30', 'keepDate').moves).toEqual(
      [],
    );
  });
});

describe('동선 순서 추천 (docs/20 G6)', () => {
  const at = (id: string, lat: number, startTime?: string) =>
    ({
      id,
      title: id,
      date: '2026-11-01',
      order: id,
      kind: 'place',
      tripId: 't',
      place: { coords: { lat, lng: 0 } },
      ...(startTime ? { startTime } : {}),
    }) as unknown as ItineraryItem;
  const dist = (a: { lat: number }, b: { lat: number }) => Math.abs(a.lat - b.lat) * 111;

  it('시간 없는 장소만 가까운 순서로, 시간 정한 일정은 제자리', () => {
    const list = [
      at('호텔', 0, '09:00'),
      at('C', 3),
      at('A', 1),
      at('B', 2),
      at('저녁', 4, '19:00'),
    ];
    const r = shortestOrder(list, dist)!;
    expect(r.ids).toEqual(['호텔', 'A', 'B', 'C', '저녁']);
    expect(r.savedKm).toBeCloseTo(444, 0);
  });

  it('이미 가장 짧으면 null, 8곳 이상도 2-opt로 줄인다', () => {
    expect(shortestOrder([at('A', 1), at('B', 2), at('C', 3)], dist)).toBeNull();
    const many = [9, 1, 8, 2, 7, 3, 6, 4, 5].map((n) => at(`p${n}`, n));
    const r = shortestOrder(many, dist)!;
    const asc = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
    expect([asc, [...asc].reverse()]).toContainEqual(r.ids);
    expect(r.savedKm).toBeGreaterThan(0);
  });
});
