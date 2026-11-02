import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v9-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v8 → v9: 예전 여행(샘플 표시 없음)도 그대로 읽히고 사용자가 만든 것으로 본다', async () => {
  const old = new Dexie(NAME);
  old.version(8).stores({ trips: 'id, startDate, updatedAt, dirty' });
  await old.table('trips').add({ id: 't', title: '도쿄', startDate: '2026-11-01', dirty: 0 });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(9);
  const row = await db.trips.get('t');
  expect(row).toMatchObject({ title: '도쿄' });
  expect(row?.sample).toBeUndefined();
  db.close();
});
