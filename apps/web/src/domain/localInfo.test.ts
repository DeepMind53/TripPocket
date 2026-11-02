import type { Booking } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import {
  arrivalToStay,
  nightsWithoutStay,
  placeTips,
  voucherBookings,
  vouchersNotSaved,
} from './localInfo';

const T = '2026-10-01T00:00:00.000Z';
const bk = (title: string, details: Booking['details'], date = '2026-11-01'): Booking =>
  ({
    id: title,
    tripId: 't',
    kind: 'tour',
    title,
    start: { date },
    details,
    createdAt: T,
    updatedAt: T,
  }) as Booking;

describe('실험실 (2026-11-03)', () => {
  const stay = (start: string, end?: string, extra: Partial<Booking> = {}): Booking =>
    ({
      ...bk('호텔', undefined, start),
      kind: 'lodging',
      end: end ? { date: end } : undefined,
      ...extra,
    }) as Booking;

  it('숙소 없는 밤: 마지막 날 밤은 빼고, 지운 예약도 빼고', () => {
    const trip = { startDate: '2026-11-10', endDate: '2026-11-14' };
    expect(nightsWithoutStay(trip, [stay('2026-11-10', '2026-11-12')])).toEqual([
      '2026-11-12',
      '2026-11-13',
    ]);
    expect(
      nightsWithoutStay(trip, [stay('2026-11-10', '2026-11-14', { deletedAt: T })]),
    ).toHaveLength(4);
    // 체크아웃 날이 없으면 하룻밤
    expect(
      nightsWithoutStay({ startDate: '2026-11-10', endDate: '2026-11-11' }, [stay('2026-11-10')]),
    ).toEqual([]);
  });

  it('도착 공항 → 첫 숙소', () => {
    const flight = {
      ...bk('KE703', undefined, '2026-11-10'),
      kind: 'flight',
      end: { date: '2026-11-10', place: 'NRT 나리타' },
    } as Booking;
    const hotel = stay('2026-11-10', '2026-11-12', {
      title: '신주쿠 호텔',
      details: { address: '도쿄 신주쿠 3-1' },
    });
    expect(arrivalToStay([hotel, flight])).toEqual({
      from: 'NRT 나리타',
      to: '도쿄 신주쿠 3-1',
      date: '2026-11-10',
    });
    expect(arrivalToStay([flight])).toBeNull();
  });

  it('장소 맞춤 팁: 이름으로 사원·온천·해변·산', () => {
    expect(placeTips([{ title: '왓 아룬' }, { title: '하코네 온천' }])).toEqual(['dress', 'onsen']);
    expect(placeTips([{ title: 'Wat Pho' }, { title: '이파네마 비치' }])).toEqual([
      'dress',
      'beach',
    ]);
    expect(placeTips([{ title: '신사동 가로수길' }, { title: '이치란' }])).toEqual([]);
    expect(placeTips([{ title: '한라산 등산' }])).toEqual(['hike']);
  });

  it('바우처: 링크만 있고 기기에 문서가 없는 예약 수 · 모아보기 순서', () => {
    const list = [
      bk('호텔', {}),
      bk('투어', { voucherUrl: 'https://v.example/1' }, '2026-11-02'),
      bk('티켓', { voucherUrl: 'https://v.example/2' }),
    ];
    expect(vouchersNotSaved(list, new Set(['티켓']))).toBe(1);
    expect(voucherBookings(list).map((b) => b.title)).toEqual(['티켓', '투어']);
    // 문서를 붙인 예약도 (2026-11-02) — 날짜·시각 순
    expect(voucherBookings(list, new Set(['호텔'])).map((b) => b.title)).toEqual([
      '호텔',
      '티켓',
      '투어',
    ]);
  });
});
