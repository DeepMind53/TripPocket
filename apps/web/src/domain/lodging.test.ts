import type { Booking, ItineraryItem } from '@trippocket/shared';
import {
  bookingRowsForDay,
  currentItem,
  lodgingForNight,
  minutesUntil,
  nextItem,
  nowTimeIn,
} from './lodging';

const base = {
  tripId: 't',
  createdAt: '2026-10-22T00:00:00.000Z',
  updatedAt: '2026-10-22T00:00:00.000Z',
};
const hotel = (id: string, start: string, end: string): Booking => ({
  ...base,
  id,
  kind: 'lodging',
  title: id,
  start: { date: start },
  end: { date: end },
});

describe('그날 밤 숙소', () => {
  const bookings = [
    hotel('신주쿠', '2026-10-24', '2026-10-26'),
    hotel('하코네', '2026-10-26', '2026-10-27'),
  ];

  it('체크인 날부터 체크아웃 전날까지, 몇 번째 밤인지', () => {
    expect(lodgingForNight(bookings, '2026-10-24')).toMatchObject({ night: 1, nights: 2 });
    expect(lodgingForNight(bookings, '2026-10-25')?.booking.title).toBe('신주쿠');
    // 체크아웃 날 밤은 다음 숙소
    expect(lodgingForNight(bookings, '2026-10-26')).toMatchObject({ night: 1, nights: 1 });
    expect(lodgingForNight(bookings, '2026-10-26')?.booking.title).toBe('하코네');
    expect(lodgingForNight(bookings, '2026-10-27')).toBeNull();
  });
});

describe('다음 일정', () => {
  const item = (title: string, startTime?: string, done = false): ItineraryItem => ({
    ...base,
    id: title,
    date: '2026-10-25',
    order: 'V',
    kind: 'place',
    title,
    ...(startTime ? { startTime } : {}),
    ...(done ? { done } : {}),
  });

  it('지금 이후 첫 일정, 다녀온 건 건너뛴다', () => {
    const list = [
      item('아침', '09:00'),
      item('점심', '11:30', true),
      item('저녁', '18:00'),
      item('메모'),
    ];
    expect(nextItem(list, '10:00')?.title).toBe('저녁');
    expect(nextItem(list, '19:00')?.title).toBe('메모');
    expect(nextItem([item('끝', '09:00', true)], '08:00')).toBeNull();
  });

  it('지금 하고 있을 일정: 시작이 지난 것 중 마지막, 3시간 넘으면 없음 (docs/20 U2)', () => {
    const list = [item('아침', '09:00'), item('점심', '11:30'), item('저녁', '18:00')];
    expect(currentItem(list, '12:00')?.title).toBe('점심');
    expect(currentItem(list, '08:00')).toBeNull();
    expect(currentItem(list, '15:00')).toBeNull();
    expect(currentItem([item('점심', '11:30', true)], '12:00')).toBeNull();
  });

  it('여행지 시각과 남은 분', () => {
    expect(nowTimeIn('Asia/Tokyo', new Date('2026-10-25T00:30:00Z'))).toBe('09:30');
    expect(minutesUntil('10:55', '11:30')).toBe(35);
  });
});

describe('그날 예약 줄', () => {
  const b = (
    id: string,
    kind: Booking['kind'],
    start: string,
    time?: string,
    end?: string,
  ): Booking => ({
    ...base,
    id,
    kind,
    title: id,
    start: { date: start, ...(time ? { time } : {}) },
    ...(end ? { end: { date: end, time: '06:00' } } : {}),
  });

  it('숙소는 빼고, 밤 비행기는 도착일에도, 시간순', () => {
    const list = [
      b('호텔', 'lodging', '2026-10-24', undefined, '2026-10-26'),
      b('저녁', 'restaurant', '2026-10-24', '19:00'),
      b('밤비행', 'flight', '2026-10-24', '23:30', '2026-10-25'),
      b('투어', 'tour', '2026-10-24', '10:00'),
    ];
    expect(bookingRowsForDay(list, '2026-10-24').map((r) => r.booking.id)).toEqual([
      '투어',
      '저녁',
      '밤비행',
    ]);
    expect(bookingRowsForDay(list, '2026-10-25')).toEqual([
      expect.objectContaining({ part: 'arrive', time: '06:00' }),
    ]);
  });
});

describe('숙소 조식 (사용자 요청 2026-10-26)', () => {
  const stay = (details: object) =>
    ({
      id: 'h',
      tripId: 't',
      kind: 'lodging',
      title: '호텔',
      start: { date: '2026-11-01' },
      end: { date: '2026-11-04' },
      details,
    }) as unknown as Booking;
  it('체크인 다음 날 ~ 체크아웃 날 아침, 날짜를 고르면 그날만', async () => {
    const { breakfastMornings, breakfastOn } = await import('./lodging');
    expect(breakfastMornings(stay({}))).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
    expect(breakfastOn([stay({ breakfast: true })], '2026-11-01')).toBeNull();
    expect(breakfastOn([stay({ breakfast: true })], '2026-11-04')?.title).toBe('호텔');
    expect(
      breakfastOn([stay({ breakfast: true, breakfastDates: ['2026-11-03'] })], '2026-11-02'),
    ).toBeNull();
    expect(
      breakfastOn([stay({ breakfast: true, breakfastDates: ['2026-11-03'] })], '2026-11-03'),
    ).not.toBeNull();
    expect(breakfastOn([stay({ breakfast: false })], '2026-11-02')).toBeNull();
  });
});
