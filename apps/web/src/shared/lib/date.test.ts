import { formatMonthDay, formatPeriod, formatTripBadge, formatTripLength } from './dateFormat';
import { buildMonths, isInRange, pickRange } from './dateRange';

describe('날짜 표기', () => {
  it('월.일 (요일)', () => {
    expect(formatMonthDay('2026-10-24')).toBe('10.24 (토)');
  });

  it('기간: 같은 해면 끝 연도 생략, 다르면 표시', () => {
    expect(formatPeriod('2026-10-24', '2026-10-28')).toBe('2026.10.24 – 10.28');
    expect(formatPeriod('2026-12-30', '2027-01-02')).toBe('2026.12.30 – 2027.01.02');
  });

  it('박·일', () => {
    expect(formatTripLength('2026-10-24', '2026-10-28')).toBe('4박 5일');
    expect(formatTripLength('2026-10-24', '2026-10-24')).toBe('당일치기');
  });

  it('D-day 배지', () => {
    expect(formatTripBadge('2026-10-24', '2026-10-28', '2026-10-21')).toBe('D-3');
    expect(formatTripBadge('2026-10-24', '2026-10-28', '2026-10-24')).toBe('D-DAY');
    expect(formatTripBadge('2026-10-24', '2026-10-28', '2026-10-25')).toBe('여행 중 · 2일차');
    expect(formatTripBadge('2026-10-24', '2026-10-28', '2026-10-29')).toBe('다녀온 여행');
  });
});

describe('날짜 범위 고르기', () => {
  it('출발일 → 도착일 순서로 고른다', () => {
    let r = pickRange({ start: null, end: null }, '2026-10-24');
    expect(r).toEqual({ start: '2026-10-24', end: null });
    r = pickRange(r, '2026-10-28');
    expect(r).toEqual({ start: '2026-10-24', end: '2026-10-28' });
    expect(isInRange(r, '2026-10-26')).toBe(true);
    expect(isInRange(r, '2026-10-29')).toBe(false);
  });

  it('같은 날을 두 번 누르면 당일치기', () => {
    const r = pickRange({ start: '2026-10-24', end: null }, '2026-10-24');
    expect(r).toEqual({ start: '2026-10-24', end: '2026-10-24' });
  });

  it('출발일보다 앞을 누르거나 범위가 완성된 뒤 누르면 새로 시작', () => {
    expect(pickRange({ start: '2026-10-24', end: null }, '2026-10-20')).toEqual({
      start: '2026-10-20',
      end: null,
    });
    expect(pickRange({ start: '2026-10-24', end: '2026-10-28' }, '2026-11-02')).toEqual({
      start: '2026-11-02',
      end: null,
    });
  });

  it('달력: 윤년 2월과 연말을 넘어간다', () => {
    const [feb, mar] = buildMonths('2028-02-15', 2);
    expect(feb?.days).toHaveLength(29);
    expect(feb?.leading).toBe(2); // 2028-02-01은 화요일
    expect(mar?.days[0]).toBe('2028-03-01');
    const months = buildMonths('2026-11-03', 3);
    expect(months.map((m) => m.key)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});
