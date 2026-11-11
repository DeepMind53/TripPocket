import { resetLocalDb } from '../dev';
import { db } from '../db';
import { bookingRepo } from './bookingRepo';
import { itemRepo } from './itemRepo';
import { tripRepo } from './tripRepo';

beforeEach(resetLocalDb);

it('예약을 지우면 일정표로 넘어간 그 예약 일정도 함께 지우고, 되살리면 함께 되살린다', async () => {
  const trip = await tripRepo.create({
    title: '방콕',
    destinations: [{ name: '방콕', kind: 'city', countryCode: 'TH' }],
    startDate: '2026-10-24',
    endDate: '2026-10-27',
    timezone: 'Asia/Bangkok',
    cover: {},
  });
  const stay = await bookingRepo.create({
    tripId: trip.id,
    kind: 'lodging',
    title: '호텔',
    start: { date: '2026-10-24' },
    end: { date: '2026-10-27' },
  });
  const linked = await itemRepo.create({
    tripId: trip.id,
    date: '2026-10-24',
    kind: 'lodging',
    title: '호텔',
    bookingId: stay.id,
  });
  // 예전에 따로 지운 같은 예약 일정은 되살리지 않는다
  const earlier = await itemRepo.create({
    tripId: trip.id,
    date: '2026-10-25',
    kind: 'lodging',
    title: '호텔 둘째 날',
    bookingId: stay.id,
  });
  await itemRepo.softDelete(earlier.id);
  const other = await itemRepo.create({
    tripId: trip.id,
    date: '2026-10-24',
    kind: 'food',
    title: '팟타이',
  });

  await new Promise((r) => setTimeout(r, 5));
  await bookingRepo.softDelete(stay.id);
  expect((await db.items.get(linked.id))?.deletedAt).toBeTruthy();
  expect((await db.items.get(other.id))?.deletedAt).toBeUndefined();
  expect((await itemRepo.listByTrip(trip.id)).map((i) => i.title)).toEqual(['팟타이']);

  await bookingRepo.restore(stay.id);
  expect((await db.items.get(linked.id))?.deletedAt).toBeUndefined();
  expect((await db.items.get(earlier.id))?.deletedAt).toBeTruthy();
});
