import { describe, expect, it } from 'vitest';
import { addDays, diffDays, todayIn, weekday } from './date/localDate';
import { dayNumberOf, daysUntil, getTripDays, getTripStatus } from './date/tripDays';
import { uuidv7 } from './id/uuidv7';
import { compareKeys, keyBetween, keysBetween } from './order/fractionalIndex';
import { ItineraryItemSchema, TripSchema } from './schema/entities';

describe('날짜', () => {
  it('일 단위 더하기·빼기는 월말·연말을 넘어간다', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(diffDays('2026-10-24', '2026-10-28')).toBe(4);
  });

  it('요일 계산 (0=일요일)', () => {
    expect(weekday('2026-10-24')).toBe(6); // 토
    expect(weekday('2026-10-25')).toBe(0); // 일
  });

  it('여행지 타임존 기준 오늘 — 서울은 이미 다음 날일 수 있다', () => {
    const now = new Date('2026-10-24T16:30:00Z'); // 서울 25일 01:30, 뉴욕 24일 12:30
    expect(todayIn('Asia/Seoul', now)).toBe('2026-10-25');
    expect(todayIn('America/New_York', now)).toBe('2026-10-24');
  });

  it('여행 일차·상태·D-day', () => {
    expect(getTripDays('2026-10-24', '2026-10-26')).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(getTripStatus('2026-10-24', '2026-10-28', '2026-10-21')).toBe('upcoming');
    expect(getTripStatus('2026-10-24', '2026-10-28', '2026-10-24')).toBe('ongoing');
    expect(getTripStatus('2026-10-24', '2026-10-28', '2026-10-28')).toBe('ongoing');
    expect(getTripStatus('2026-10-24', '2026-10-28', '2026-10-29')).toBe('past');
    expect(daysUntil('2026-10-24', '2026-10-21')).toBe(3);
    expect(dayNumberOf('2026-10-24', '2026-10-28', '2026-10-25')).toBe(2);
    expect(dayNumberOf('2026-10-24', '2026-10-28', '2026-10-29')).toBeNull();
  });
});

describe('uuidv7', () => {
  it('UUID v7 형식이고 만든 순서대로 정렬된다', () => {
    const ids = Array.from({ length: 500 }, () => uuidv7());
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('정렬 키', () => {
  it('두 키 사이에 들어간다', () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    const mid = keyBetween(a, b);
    expect(compareKeys(a, mid)).toBe(-1);
    expect(compareKeys(mid, b)).toBe(-1);
    expect(compareKeys(keyBetween(null, a), a)).toBe(-1);
  });

  it('같은 자리에 1,000번 연속으로 끼워 넣어도 순서가 유지된다', () => {
    let low = keyBetween(null, null);
    const high = keyBetween(low, null);
    const inserted: string[] = [];
    for (let i = 0; i < 1000; i++) {
      low = keyBetween(low, high);
      inserted.push(low);
    }
    expect([...inserted].sort(compareKeys)).toEqual(inserted);
    expect(compareKeys(inserted.at(-1) as string, high)).toBe(-1);
  });

  it('맨 앞에 계속 넣어도 순서가 유지된다', () => {
    let first = keyBetween(null, null);
    const keys = [first];
    for (let i = 0; i < 300; i++) {
      first = keyBetween(null, first);
      keys.unshift(first);
    }
    expect([...keys].sort(compareKeys)).toEqual(keys);
  });

  it('n개 키를 한 번에 고르게 만든다', () => {
    const keys = keysBetween(null, null, 50);
    expect(keys).toHaveLength(50);
    expect([...keys].sort(compareKeys)).toEqual(keys);
    expect(new Set(keys).size).toBe(50);
  });

  it('순서가 뒤바뀐 입력은 오류', () => {
    expect(() => keyBetween('b', 'a')).toThrow();
  });
});

const now = '2026-10-22T10:00:00.000Z';

describe('스키마', () => {
  const trip = {
    id: uuidv7(),
    createdAt: now,
    updatedAt: now,
    title: '도쿄 가을여행',
    destinations: ['도쿄'],
    startDate: '2026-10-24',
    endDate: '2026-10-28',
    timezone: 'Asia/Tokyo',
    cover: { emoji: '🗼', color: '#2F6BFF' },
  };

  it('올바른 여행은 통과하고 제목 앞뒤 공백은 지운다', () => {
    const parsed = TripSchema.parse({ ...trip, title: '  도쿄 가을여행 ' });
    expect(parsed.title).toBe('도쿄 가을여행');
  });

  it('종료일이 시작일보다 빠르면 거부한다', () => {
    const r = TripSchema.safeParse({ ...trip, endDate: '2026-10-20' });
    expect(r.success).toBe(false);
  });

  it('잘못된 날짜·빈 제목을 거부한다', () => {
    expect(TripSchema.safeParse({ ...trip, startDate: '2026-02-30' }).success).toBe(false);
    expect(TripSchema.safeParse({ ...trip, title: '   ' }).success).toBe(false);
  });

  it('일정: 날짜 없음(가고 싶은 곳) 허용, 시간 형식 검사', () => {
    const item = {
      id: uuidv7(),
      createdAt: now,
      updatedAt: now,
      tripId: trip.id,
      date: null,
      order: keyBetween(null, null),
      kind: 'food',
      title: '이치란 라멘',
    };
    expect(ItineraryItemSchema.safeParse(item).success).toBe(true);
    expect(ItineraryItemSchema.safeParse({ ...item, startTime: '09:00' }).success).toBe(true);
    expect(ItineraryItemSchema.safeParse({ ...item, startTime: '9:00' }).success).toBe(false);
    expect(ItineraryItemSchema.safeParse({ ...item, startTime: '24:00' }).success).toBe(false);
    expect(ItineraryItemSchema.safeParse({ ...item, kind: 'expense' }).success).toBe(false);
  });
});
