import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v7-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v6 → v7: 나라 코드 없는 저장한 장소도 그대로 읽힌다', async () => {
  const old = new Dexie(NAME);
  old.version(6).stores({ savedPlaces: 'id, cityTag, updatedAt, dirty' });
  await old
    .table('savedPlaces')
    .add({ id: 's', name: '이치란', kind: 'food', cityTag: '도쿄', dirty: 0 });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBe(7);
  expect(await db.savedPlaces.get('s')).toMatchObject({ name: '이치란', cityTag: '도쿄' });
  expect((await db.savedPlaces.get('s'))?.countryCode).toBeUndefined();
  db.close();
});
