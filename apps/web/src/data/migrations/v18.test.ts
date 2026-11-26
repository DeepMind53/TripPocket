import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v18-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v17 → v18: 예전 예약은 연결 없음, 기존 일정 연결을 붙일 수 있다', async () => {
  const old = new Dexie(NAME);
  old.version(17).stores({ bookings: 'id, tripId, updatedAt, dirty' });
  await old.table('bookings').add({ id: 'b', tripId: 't', kind: 'ticket', title: '입장권' });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(18);
  expect((await db.bookings.get('b'))?.attachedItemId).toBeUndefined();
  await db.bookings.update('b', { attachedItemId: 'i' });
  expect((await db.bookings.get('b'))?.attachedItemId).toBe('i');
  db.close();
});
