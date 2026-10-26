import type { Booking, ChecklistItem, ItineraryItem } from '@trippocket/shared';
import { describe, expect, it } from 'vitest';
import { searchTrip } from './tripSearch';

const base = { tripId: 't', createdAt: '', updatedAt: '' };
const item = (id: string, title: string, extra: Partial<ItineraryItem> = {}) =>
  ({ ...base, id, title, kind: 'place', date: '2026-10-24', order: id, ...extra }) as ItineraryItem;
const booking = (id: string, title: string, extra: Partial<Booking> = {}) =>
  ({ ...base, id, title, kind: 'lodging', start: { date: '2026-10-24' }, ...extra }) as Booking;
const check = (id: string, text: string, list: ChecklistItem['list'] = 'packing') =>
  ({ ...base, id, text, list, order: id, checked: false }) as ChecklistItem;

const data = {
  items: [
    item('i1', '이치란 라멘', { place: { name: '이치란 신주쿠점', address: '신주쿠 3-34-11' } }),
    item('i2', '센소지', { memo: '라멘 먹고 가기' }),
    item('gone', '라멘 박물관', { deletedAt: 'x' }),
  ],
  bookings: [
    booking('b1', '신주쿠 워싱턴 호텔', { confirmationNo: 'AB12CD' }),
    booking('b2', '대한항공 KE703'),
  ],
  checklist: [check('c1', '여권'), check('c2', 'JP:visitJapanWeb', 'essentials')],
};

describe('searchTrip', () => {
  it('제목이 맞은 것 먼저, 메모·주소에서 맞은 것은 뒤에 (맞은 글과 함께)', () => {
    expect(searchTrip('라멘', data)).toEqual([
      { kind: 'item', id: 'i1', title: '이치란 라멘', date: '2026-10-24' },
      { kind: 'item', id: 'i2', title: '센소지', date: '2026-10-24', matched: '라멘 먹고 가기' },
    ]);
  });

  it('예약번호·준비물도, 공백·대소문자 무시', () => {
    expect(searchTrip('ab12', data).map((h) => h.id)).toEqual(['b1']);
    expect(searchTrip('ke 703', data).map((h) => h.id)).toEqual(['b2']);
    expect(searchTrip('여권', data).map((h) => h.id)).toEqual(['c1']);
  });

  it('초성으로도 찾는다, 지운 것·필수 항목 키는 빼고, 빈 검색은 없음', () => {
    expect(searchTrip('ㅅㅅㅈ', data).map((h) => h.id)).toEqual(['i2']);
    expect(searchTrip('visit', data)).toEqual([]);
    expect(searchTrip('  ', data)).toEqual([]);
  });
});
