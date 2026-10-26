import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v5-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v4 → v5: 기존 여행은 그대로, 예약 문서 표가 생긴다', async () => {
  const old = new Dexie(NAME);
  old.version(4).stores({ trips: 'id, startDate, updatedAt, dirty' });
  await old.table('trips').add({ id: 't', title: '도쿄', dirty: 0 });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(5);
  expect((await db.trips.get('t'))?.title).toBe('도쿄');
  await db.attachments.add({
    id: 'a',
    tripId: 't',
    bookingId: 'b',
    name: 'x.pdf',
    mime: 'application/pdf',
    size: 3,
    blob: new Blob(['abc']),
    createdAt: 'x',
    remote: 0,
  });
  expect(await db.attachments.where('bookingId').equals('b').count()).toBe(1);
  db.close();
});
