import type { Booking, ItineraryItem, Trip } from '@trippocket/shared';
import { tripToText } from './shareText';

const T = '2026-10-23T00:00:00.000Z';
const trip = {
  id: 't',
  title: '도쿄 가을여행',
  destinations: [],
  startDate: '2026-10-24',
  endDate: '2026-10-25',
  timezone: 'Asia/Tokyo',
  cover: { emoji: '🗼' },
  createdAt: T,
  updatedAt: T,
} as Trip;
const item = (title: string, date: string | null, order: string, startTime?: string) =>
  ({
    id: title,
    tripId: 't',
    date,
    order,
    kind: 'place',
    title,
    startTime,
    memo: '비밀 메모',
    createdAt: T,
    updatedAt: T,
  }) as ItineraryItem;

describe('일정 텍스트', () => {
  it('일차별 시간·제목, 숙소, 가고 싶은 곳 — 메모·예약번호는 빼고', () => {
    const text = tripToText(
      trip,
      [
        item('센소지', '2026-10-24', 'b', '09:00'),
        item('라멘', '2026-10-24', 'a'),
        item('디즈니', null, 'a'),
      ],
      [
        {
          id: 'b',
          tripId: 't',
          kind: 'lodging',
          title: '신주쿠 호텔',
          confirmationNo: 'ABC123',
          start: { date: '2026-10-24' },
          end: { date: '2026-10-25' },
          createdAt: T,
          updatedAt: T,
        } as Booking,
      ],
    );
    expect(text).toBe(
      [
        '🗼 도쿄 가을여행',
        '2026.10.24 – 10.25',
        '',
        '[1일차 10.24 (토)]',
        '라멘',
        '09:00 센소지',
        '🛏 신주쿠 호텔',
        '',
        '[가고 싶은 곳]',
        '· 디즈니',
      ].join('\n'),
    );
    expect(text).not.toMatch(/ABC123|비밀/);
  });
});
