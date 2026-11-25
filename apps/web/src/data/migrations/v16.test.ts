import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v16-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v15 → v16: 예전 영수증은 줄 자리·번역 없음, 붙일 수 있다 (사진 위에 번역 덮기)', async () => {
  const old = new Dexie(NAME);
  old.version(15).stores({ photos: 'id, tripId, itemId' });
  await old.table('photos').add({ id: 'p', tripId: 't', itemId: 'i', kind: 'receipt', text: 'x' });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(16);
  expect((await db.photos.get('p'))?.rows).toBeUndefined();
  await db.photos.update('p', { rows: [{ text: 'x', ko: '엑스' }] });
  expect((await db.photos.get('p'))?.rows?.[0]?.ko).toBe('엑스');
  db.close();
});
