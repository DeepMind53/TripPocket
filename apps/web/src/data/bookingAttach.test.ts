import { attachableBookings, attachableStops } from '../domain/bookingAttach';
import { attachBooking, detachBooking } from './bookingAttach';
import { placeBookingsInPlan, syncBookingToPlan } from './bookingPlanner';
import { resetLocalDb } from './dev';
import { bookingRepo } from './repositories/bookingRepo';
import { itemRepo } from './repositories/itemRepo';
import { tripRepo } from './repositories/tripRepo';

beforeEach(resetLocalDb);

const label = (a: string) => `${a} 도착`;

async function setup() {
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [],
    startDate: '2026-10-24',
    endDate: '2026-10-26',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  const temple = await itemRepo.create({
    tripId: trip.id,
    date: '2026-10-25',
    kind: 'place',
    title: '센소지',
    startTime: '10:00',
    place: { name: '센소지' },
  });
  const ticket = await bookingRepo.create({
    tripId: trip.id,
    kind: 'ticket',
    title: '센소지 입장권',
    start: { date: '2026-10-25', time: '11:00' },
  });
  return { trip, temple, ticket };
}

describe('투어·티켓을 기존 일정에 연결 (2026-11-26)', () => {
  it('연결하면 예약이 만든 칸은 휴지통으로, 기존 일정은 이름·시간 그대로 예약 표시만', async () => {
    const { trip, temple, ticket } = await setup();
    expect(await placeBookingsInPlan(trip.id, label)).toBe(1);
    await attachBooking(ticket.id, temple.id);
    const items = await itemRepo.listByTrip(trip.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: temple.id, title: '센소지', startTime: '10:00' });
    expect(items[0]!.bookingId).toBe(ticket.id);
    expect(await bookingRepo.get(ticket.id)).toMatchObject({ attachedItemId: temple.id });
    // 다시 일정 화면을 열어도 새 칸을 만들지 않는다
    expect(await placeBookingsInPlan(trip.id, label)).toBe(0);
  });

  it('예약을 고쳐도 연결한 일정은 덮어쓰지 않고, 예약을 지워도 일정은 남는다', async () => {
    const { trip, temple, ticket } = await setup();
    await attachBooking(ticket.id, temple.id);
    await bookingRepo.update(ticket.id, { title: '바뀐 이름', start: { date: '2026-10-26' } });
    expect(await syncBookingToPlan(ticket.id, label)).toBe(0);
    expect(await itemRepo.get(temple.id)).toMatchObject({ title: '센소지', date: '2026-10-25' });
    await bookingRepo.softDelete(ticket.id);
    expect((await itemRepo.listByTrip(trip.id)).map((i) => i.id)).toEqual([temple.id]);
  });

  it('끊기: 일정 상세에서는 새 칸 없이, 예약 화면 [새 일정으로 넣기]는 새 칸으로', async () => {
    const { trip, temple, ticket } = await setup();
    await attachBooking(ticket.id, temple.id);
    await detachBooking(ticket.id, false);
    expect((await itemRepo.get(temple.id))?.bookingId).toBeUndefined();
    expect(await placeBookingsInPlan(trip.id, label)).toBe(0);
    await attachBooking(ticket.id, temple.id);
    await detachBooking(ticket.id, true);
    expect(await placeBookingsInPlan(trip.id, label)).toBe(1);
    expect((await itemRepo.listByTrip(trip.id)).map((i) => i.title)).toContain('센소지 입장권');
  });

  it('다른 일정으로 옮겨 연결하면 예전 일정은 표시만 떼고 남긴다', async () => {
    const { trip, temple, ticket } = await setup();
    const park = await itemRepo.create({
      tripId: trip.id,
      date: '2026-10-25',
      kind: 'place',
      title: '우에노 공원',
    });
    await attachBooking(ticket.id, temple.id);
    await attachBooking(ticket.id, park.id);
    expect((await itemRepo.get(temple.id))?.bookingId).toBeUndefined();
    expect((await itemRepo.get(park.id))?.bookingId).toBe(ticket.id);
  });
});

describe('연결 후보 고르기', () => {
  const stop = (id: string, date: string | null, kind = 'place', bookingId?: string) =>
    ({ id, date, kind, order: 'a0', ...(bookingId ? { bookingId } : {}) }) as never;

  it('장소 일정만, 예약 표시가 있는 칸은 빼고(지금 연결된 일정은 포함), 예약 날짜 먼저', () => {
    const items = [
      stop('a', '2026-10-24'),
      stop('b', '2026-10-25'),
      stop('memo', '2026-10-25', 'note'),
      stop('bus', '2026-10-25', 'transport'),
      stop('auto', '2026-10-25', 'activity', 'tk'),
      stop('mine', '2026-10-26', 'place', 'tk'),
      stop('wish', null),
    ];
    const out = attachableStops(
      items as { id: string; date: string | null; kind: 'place'; order: string }[],
      {
        date: '2026-10-25',
        attachedItemId: 'mine',
      },
    ).map((i) => i.id);
    expect(out).toEqual(['b', 'a', 'mine', 'wish']);
  });

  it('일정 상세: 투어·티켓 중 다른 일정에 연결되지 않은 예약', () => {
    const b = (id: string, kind: string, attachedItemId?: string) =>
      ({
        id,
        kind,
        start: { date: '2026-10-25' },
        ...(attachedItemId ? { attachedItemId } : {}),
      }) as never;
    const out = attachableBookings(
      [b('t1', 'tour'), b('t2', 'ticket', 'x'), b('t3', 'ticket', 'me'), b('f', 'flight')],
      'me',
    ).map((x) => x.id);
    expect(out).toEqual(['t1', 't3']);
  });
});
