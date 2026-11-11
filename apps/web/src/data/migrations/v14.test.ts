import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v14-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v13 → v14: 예전 사진은 그대로 (분류 전), 분류 묶음을 붙일 수 있다', async () => {
  const old = new Dexie(NAME);
  old.version(13).stores({ photos: 'id, tripId, itemId' });
  await old
    .table('photos')
    .add({ id: 'p', tripId: 't', itemId: 'i', kind: 'photo', createdAt: 'x' });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(14);
  expect((await db.photos.get('p'))?.tag).toBeUndefined();
  await db.photos.update('p', { tag: 'food' });
  expect((await db.photos.get('p'))?.tag).toBe('food');
  db.close();
});
