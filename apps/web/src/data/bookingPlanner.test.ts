import { placeBookingsInPlan, syncBookingToPlan } from './bookingPlanner';
import { resetLocalDb } from './dev';
import { bookingRepo } from './repositories/bookingRepo';
import { itemRepo } from './repositories/itemRepo';
import { tripRepo } from './repositories/tripRepo';

const arrive = (a: string) => `${a} 도착`;

beforeEach(async () => {
  await resetLocalDb();
});

it('예약을 고치면 일정표의 그 예약 일정도 바뀐다 (날짜 이동, 메모·다녀옴은 그대로)', async () => {
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-11-12',
    endDate: '2026-11-15',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  const b = await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: 'KE705',
    start: { date: '2026-11-12', time: '10:00', place: 'ICN' },
    end: { date: '2026-11-12', time: '12:30', place: 'NRT' },
  });
  await placeBookingsInPlan(trip.id, arrive);
  const [dep] = (await itemRepo.listByTrip(trip.id)).filter((i) => i.transport);
  await itemRepo.update(dep!.id, { memo: '창가 좌석', done: true });
  await itemRepo.create({
    tripId: trip.id,
    date: '2026-11-13',
    kind: 'food',
    title: '아침',
    startTime: '08:00',
  });

  await bookingRepo.update(b.id, {
    title: 'KE707',
    start: { date: '2026-11-13', time: '14:00', place: 'ICN' },
    end: { date: '2026-11-13', time: '16:20', place: 'NRT' },
  });
  expect(await syncBookingToPlan(b.id, arrive)).toBe(2);

  const items = await itemRepo.listByTrip(trip.id);
  expect(items.map((i) => [i.date, i.startTime, i.title])).toEqual([
    ['2026-11-13', '08:00', '아침'],
    ['2026-11-13', '14:00', 'KE707'],
    ['2026-11-13', '16:20', '나리타국제공항 도착'],
  ]);
  expect(items[1]).toMatchObject({ memo: '창가 좌석', done: true });
});

it('일정표에 넣기 전 예약이나 지운 일정은 건드리지 않는다', async () => {
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-11-12',
    endDate: '2026-11-15',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  const b = await bookingRepo.create({
    tripId: trip.id,
    kind: 'lodging',
    title: '호텔',
    start: { date: '2026-11-12', time: '15:00' },
    end: { date: '2026-11-14' },
  });
  expect(await syncBookingToPlan(b.id, arrive)).toBe(0);
  await placeBookingsInPlan(trip.id, arrive);
  const [stay] = await itemRepo.listByTrip(trip.id);
  await itemRepo.softDelete(stay!.id);
  await bookingRepo.update(b.id, { title: '새 호텔' });
  expect(await syncBookingToPlan(b.id, arrive)).toBe(0);
  expect(await itemRepo.listByTrip(trip.id)).toEqual([]);
});
