import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v6-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v5 → v6: 다녀옴 일정은 방문 기록으로, 나머지는 그대로', async () => {
  const old = new Dexie(NAME);
  old.version(5).stores({ items: 'id, tripId, [tripId+date], updatedAt, dirty' });
  await old.table('items').bulkAdd([
    { id: 'a', tripId: 't', date: '2026-10-24', title: '센소지', done: true, dirty: 0 },
    { id: 'b', tripId: 't', date: '2026-10-24', title: '라멘', dirty: 0 },
  ]);
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBe(6);
  expect(await db.items.get('a')).toMatchObject({ done: true, visit: 'visited', dirty: 0 });
  expect((await db.items.get('b'))?.visit).toBeUndefined();
  db.close();
});
