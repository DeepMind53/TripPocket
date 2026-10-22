import type { ItineraryItem } from '@trippocket/shared';
import { planReflow, sortByTimeKeepingUntimed } from './schedule';

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
