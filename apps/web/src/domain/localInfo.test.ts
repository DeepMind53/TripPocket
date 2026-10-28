import type { Booking } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import {
  cancelSoon,
  earlyStartAt,
  firstVisitCountries,
  isLeftDrive,
  leaveDaysNeeded,
  onsiteBookings,
  tapWater,
  voucherBookings,
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

describe('실험실 3차 (2026-10-28)', () => {
  it('좌측 통행·수돗물', () => {
    expect(isLeftDrive('JP')).toBe(true);
    expect(isLeftDrive('US')).toBe(false);
    expect(tapWater('JP')).toBe('ok');
    expect(tapWater('TW')).toBe('boil');
    expect(tapWater('VN')).toBe('no');
    expect(tapWater('ZZ')).toBeNull();
  });

  it('필요한 연차: 주말·한국 공휴일 빼고', () => {
    // 2026-10-01(목) ~ 10-05(월), 10-03 개천절(토)·10-05 대체공휴일 가정
    expect(leaveDaysNeeded('2026-10-01', '2026-10-05', new Set(['2026-10-05']))).toBe(2);
    expect(leaveDaysNeeded('2026-10-03', '2026-10-04', new Set())).toBe(0);
  });

  it('처음 가는 나라: 지난 여행에 없던 나라만 (한국 빼고)', () => {
    const trip = {
      id: 'now',
      destinations: [{ countryCode: 'JP' }, { countryCode: 'TW' }, { countryCode: 'KR' }],
    };
    const others = [
      { id: 'a', endDate: '2025-05-01', destinations: [{ countryCode: 'JP' }] },
      { id: 'b', endDate: '2027-01-01', destinations: [{ countryCode: 'TW' }] }, // 아직 안 다녀옴
    ];
    expect(firstVisitCountries(trip, others, '2026-10-28')).toEqual(['TW']);
  });

  it('무료 취소 마감 3일 안·현장 결제·바우처', () => {
    const list = [
      bk('호텔', { cancelBy: '2026-10-30', payment: 'onsite' }),
      bk('투어', { cancelBy: '2026-10-28', voucherUrl: 'https://v.example/1' }, '2026-11-02'),
      bk('티켓', { cancelBy: '2026-11-10' }),
      bk('지난 것', { cancelBy: '2026-10-20' }),
    ];
    expect(cancelSoon(list, '2026-10-28')).toEqual([
      { name: '투어', d: 0 },
      { name: '호텔', d: 2 },
    ]);
    expect(onsiteBookings(list).map((b) => b.title)).toEqual(['호텔']);
    expect(voucherBookings(list).map((b) => b.title)).toEqual(['투어']);
  });

  it('이른 출발: 첫 일정이 7시 전', () => {
    expect(
      earlyStartAt([
        { kind: 'place', startTime: '09:00' },
        { kind: 'transport', startTime: '05:40' },
      ]),
    ).toBe('05:40');
    expect(
      earlyStartAt([
        { kind: 'note', startTime: '05:00' },
        { kind: 'place', startTime: '08:00' },
      ]),
    ).toBeNull();
  });
});
