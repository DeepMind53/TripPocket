import type { LodgingReportView } from '@trippocket/shared';
import { arrangeReports, cheapRoute, isStale, latestByRoute, toNightlyKrw } from './lodgingReports';

const stay = { checkIn: '2026-11-24', nights: 3, adults: 2 };
let n = 0;
const r = (o: Partial<LodgingReportView>): LodgingReportView => ({
  id: `r${n++}`,
  hotelKey: 'agoda:1',
  hotelName: 'x',
  rooms: 1,
  site: 'agoda',
  price: 100000,
  priceType: 'nightly',
  currency: 'KRW',
  tax: 'incl',
  tags: [],
  seenOn: '2026-11-09',
  mine: false,
  ...stay,
  ...o,
});

describe('숙소 가격 기록 계산 (docs/28 §6·§7)', () => {
  it('1박 원화: 총액은 박 수로, 외화는 환율로, 모르면 null', () => {
    expect(toNightlyKrw(r({ price: 300000, priceType: 'total' }), {})).toBe(100000);
    expect(toNightlyKrw(r({ price: 13000, currency: 'JPY' }), { JPY: 9.2 })).toBe(119600);
    expect(toNightlyKrw(r({ currency: 'TWD' }), { JPY: 9.2 })).toBeNull();
  });

  it('같은 날짜 먼저·싼 순, 이상한 값은 최저가에서 빼고, 다른 날짜는 따로', () => {
    const list = [
      r({ price: 130000 }),
      r({ price: 120000 }),
      r({ price: 9000 }), // 중앙값 12만의 1/5 미만
      r({ price: 110000, checkIn: '2026-12-01' }),
    ];
    const a = arrangeReports(list, stay, {});
    expect(a.same.map((x) => x.price)).toEqual([9000, 120000, 130000]);
    expect(a.same[0]!.odd).toBe(true);
    expect(a.cheapest!.price).toBe(120000);
    expect(a.other.map((x) => x.price)).toEqual([110000]);
  });

  it('경로별 최근 기록과 자주 싼 경로 (기록 3개 이상)', () => {
    const list = arrangeReports(
      [
        r({ route: 'shinhan', price: 120000, seenOn: '2026-11-08' }),
        r({ route: 'shinhan', price: 118000, seenOn: '2026-11-09' }),
        r({ route: 'visa', price: 125000, seenOn: '2026-11-09' }),
        r({ route: 'visa', price: 121000, seenOn: '2026-11-08' }),
      ],
      stay,
      {},
    ).same;
    expect(latestByRoute(list).get('shinhan')!.price).toBe(118000);
    expect(cheapRoute(list)).toBe('shinhan');
    expect(cheapRoute(list.slice(0, 2))).toBeNull();
  });

  it('7일 지난 기록', () => {
    expect(isStale('2026-11-01', '2026-11-09')).toBe(true);
    expect(isStale('2026-11-02', '2026-11-09')).toBe(false);
  });
});
