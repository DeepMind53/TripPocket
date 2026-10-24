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

describe('일정 텍스트 — 예약·기간 밖 일정도 빠짐없이', () => {
  it('항공·식당 예약은 그날 일정 사이에 시간 맞춰, 기간 밖 일정도 따로', () => {
    const text = tripToText(
      trip,
      [
        item('센소지', '2026-10-24', 'a', '13:00'),
        item('라멘', '2026-10-24', 'b'),
        item('취소된 날 일정', '2026-10-30', 'a', '10:00'),
      ],
      [
        {
          id: 'f',
          tripId: 't',
          kind: 'flight',
          title: 'KE703 ICN→NRT',
          start: { date: '2026-10-24', time: '09:10' },
          end: { date: '2026-10-24', time: '11:30' },
          createdAt: T,
          updatedAt: T,
        } as Booking,
        {
          id: 'r',
          tripId: 't',
          kind: 'restaurant',
          title: '스시 오마카세',
          start: { date: '2026-10-25', time: '19:00' },
          createdAt: T,
          updatedAt: T,
        } as Booking,
      ],
    );
    expect(text).toContain(
      ['[1일차 10.24 (토)]', '09:10 ✈ KE703 ICN→NRT', '13:00 센소지', '라멘'].join('\n'),
    );
    expect(text).toContain(['[2일차 10.25 (일)]', '19:00 🍽 스시 오마카세'].join('\n'));
    expect(text).toContain(['[여행 기간 밖 일정]', '10.30 (금) 10:00 취소된 날 일정'].join('\n'));
  });
});
