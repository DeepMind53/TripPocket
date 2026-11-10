import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v13-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v12 → v13: 기존 일정은 그대로, 기기 전용 사진 표가 생긴다', async () => {
  const old = new Dexie(NAME);
  old.version(12).stores({ items: 'id, tripId, [tripId+date], updatedAt, dirty' });
  await old.table('items').add({ id: 'i', tripId: 't', title: '센소지', dirty: 0 });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(13);
  expect((await db.items.get('i'))?.title).toBe('센소지');
  await db.photos.add({
    id: 'p',
    tripId: 't',
    itemId: 'i',
    kind: 'receipt',
    blob: new Blob(['jpg']),
    createdAt: 'x',
  });
  expect(await db.photos.where('itemId').equals('i').count()).toBe(1);
  db.close();
});
