import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v15-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v14 → v15: 예전 일정은 모이기 표시 없음, 표시를 붙일 수 있다 (docs/27 E2)', async () => {
  const old = new Dexie(NAME);
  old.version(14).stores({ items: 'id, tripId, [tripId+date], updatedAt, dirty' });
  await old.table('items').add({ id: 'i', tripId: 't', date: '2026-11-01', title: '역 앞' });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(15);
  expect((await db.items.get('i'))?.meetup).toBeUndefined();
  await db.items.update('i', { meetup: true });
  expect((await db.items.get('i'))?.meetup).toBe(true);
  db.close();
});
