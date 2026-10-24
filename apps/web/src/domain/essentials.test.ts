import type { Booking, Trip } from '@trippocket/shared';
import { buildEssentials } from './essentials';

const trip = (codes: string[], start = '2026-11-01', end = '2026-11-04') =>
  ({
    id: 't',
    title: 't',
    timezone: 'Asia/Seoul',
    cover: {},
    startDate: start,
    endDate: end,
    destinations: codes.map((c) => ({ name: c, kind: 'city', countryCode: c })),
  }) as unknown as Trip;
const booking = (o: Partial<Booking>) =>
  ({
    id: Math.random().toString(),
    tripId: 't',
    title: 'b',
    start: { date: '2026-11-01' },
    ...o,
  }) as Booking;

describe('나라별 필수 항목 자동 판단 (docs/19)', () => {
  it('태국 4일: 비자 자동 ✓, TDAC는 3일 전부터 알림, 픽업·체크인·귀국편 예약이 있으면 자동 ✓', () => {
    const s = buildEssentials({
      trip: trip(['TH']),
      bookings: [
        booking({ kind: 'transfer' }),
        booking({ kind: 'lodging', title: '호텔', start: { date: '2026-11-01', time: '15:00' } }),
        booking({ kind: 'flight', start: { date: '2026-11-04' } }),
      ],
      checked: new Set(),
      passportExpiry: null,
      today: '2026-10-30',
    });
    const th = s.groups[0]!;
    const row = (id: string) => s.groups.flatMap((g) => g.rows).find((r) => r.item.id === id)!;
    expect(th.country?.name).toBe('태국');
    expect(row('visa')).toMatchObject({ checked: true, auto: true });
    expect(row('arrival')).toMatchObject({ checked: false, due: true });
    expect(row('airportTransfer')).toMatchObject({ auto: true });
    expect(row('checkin').note).toBe('호텔 체크인 15:00');
    expect(row('returnTicket').auto).toBe(true);
    expect(s.alert).toBe(true);
    expect(s.next?.item.id).toBe('arrival'); // 지금 해야 하는 것이 먼저
  });

  it('여권: 귀국일 + 6개월보다 일찍 끝나면 경고, 충분하면 자동 ✓', () => {
    const base = {
      trip: trip(['VN']),
      bookings: [],
      checked: new Set<string>(),
      today: '2026-10-01',
    };
    const short = buildEssentials({ ...base, passportExpiry: '2027-03-01' });
    const p = short.groups[0]!.rows.find((r) => r.item.id === 'passport')!;
    expect(p.warn).toContain('2027-05-04');
    expect(short.alert).toBe(true);
    const ok = buildEssentials({ ...base, passportExpiry: '2030-01-01' });
    expect(ok.groups[0]!.rows.find((r) => r.item.id === 'passport')).toMatchObject({
      checked: true,
      auto: true,
    });
  });

  it('직접 체크한 항목 반영, 팁은 개수에서 빠짐, 국내 여행은 비어 있음, 모르는 나라는 따로', () => {
    const s = buildEssentials({
      trip: trip(['JP']),
      bookings: [],
      checked: new Set(['JP:arrival']),
      passportExpiry: null,
      today: '2026-10-01',
    });
    expect(s.groups[0]!.rows.find((r) => r.item.id === 'arrival')?.checked).toBe(true);
    expect(
      s.groups.flatMap((g) => g.rows).filter((r) => r.item.level === 'tip').length,
    ).toBeGreaterThan(0);
    expect(s.total).toBe(
      s.groups.flatMap((g) => g.rows).filter((r) => r.item.level !== 'tip').length,
    );
    expect(
      buildEssentials({
        trip: trip(['KR']),
        bookings: [],
        checked: new Set(),
        passportExpiry: null,
        today: '2026-10-01',
      }).groups,
    ).toEqual([]);
    expect(
      buildEssentials({
        trip: trip(['NZ']),
        bookings: [],
        checked: new Set(),
        passportExpiry: null,
        today: '2026-10-01',
      }).unknown,
    ).toEqual(['NZ']);
  });

  it('무비자 기간보다 긴 여행은 비자 경고', () => {
    const s = buildEssentials({
      trip: trip(['PH'], '2026-11-01', '2026-12-15'),
      bookings: [],
      checked: new Set(),
      passportExpiry: null,
      today: '2026-10-01',
    });
    expect(s.groups[0]!.rows.find((r) => r.item.id === 'visa')?.warn).toContain('30일');
  });
});
