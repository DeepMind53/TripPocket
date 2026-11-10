import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v12-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v11 → v12: 예전 기차 예약(주소 없음)도 그대로 읽힌다', async () => {
  const old = new Dexie(NAME);
  old.version(11).stores({ bookings: 'id, tripId, [tripId+kind], updatedAt, dirty' });
  await old.table('bookings').add({
    id: 'b',
    tripId: 't',
    kind: 'train',
    title: 'KTX',
    start: { date: '2026-11-12', time: '08:00', place: '서울역' },
    dirty: 0,
  });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(12);
  const row = await db.bookings.get('b');
  expect(row?.start).toEqual({ date: '2026-11-12', time: '08:00', place: '서울역' });
  expect(row?.start.address).toBeUndefined();
  db.close();
});
