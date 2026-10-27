import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v8-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v7 → v8: 예전 준비 목록(만든 사람·공유 없음)도 그대로 읽히고 내 것으로 본다', async () => {
  const old = new Dexie(NAME);
  old.version(7).stores({ checklistItems: 'id, [tripId+list], updatedAt, dirty' });
  await old.table('checklistItems').add({
    id: 'c',
    tripId: 't',
    list: 'packing',
    text: '여권',
    checked: false,
    order: 'a0',
    dirty: 0,
  });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBe(8);
  const row = await db.checklistItems.get('c');
  expect(row).toMatchObject({ text: '여권' });
  expect(row?.ownerId).toBeUndefined();
  expect(row?.shared).toBeUndefined();
  db.close();
});
