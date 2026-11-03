import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v11-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v10 → v11: 예전 여행·일정(플랜 없음)은 그대로 기본 일정으로 읽힌다', async () => {
  const old = new Dexie(NAME);
  old.version(10).stores({
    trips: 'id, startDate, updatedAt, dirty',
    items: 'id, tripId, [tripId+date], updatedAt, dirty',
  });
  await old.table('trips').add({ id: 't', title: '도쿄', startDate: '2026-11-12', dirty: 0 });
  await old
    .table('items')
    .add({ id: 'i', tripId: 't', date: '2026-11-12', title: '센소지', dirty: 0 });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBe(11);
  expect((await db.trips.get('t'))?.dayPlans).toBeUndefined();
  const item = await db.items.get('i');
  expect(item).toMatchObject({ title: '센소지' });
  expect(item?.planId).toBeUndefined();
  db.close();
});
