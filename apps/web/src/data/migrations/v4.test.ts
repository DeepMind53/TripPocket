import Dexie from 'dexie';
import { ChecklistItemSchema } from '@trippocket/shared';
import { TripPocketDB } from '../db';

const NAME = 'migration-v4-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v3 → v4: 기존 준비물은 그대로, 새 목록 종류 essentials를 저장할 수 있다', async () => {
  const old = new Dexie(NAME);
  old.version(3).stores({ checklistItems: 'id, tripId, [tripId+list], updatedAt, dirty' });
  const row = {
    id: '0190f2a4-0000-7000-8000-000000000009',
    tripId: '0190f2a4-0000-7000-8000-000000000001',
    list: 'packing',
    text: '여권',
    checked: false,
    order: 'a0',
    createdAt: '2026-10-22T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
  };
  await old.table('checklistItems').add({ ...row, dirty: 0 });
  old.close();

  const db = new TripPocketDB(NAME);
  expect(db.verno).toBe(4);
  const [kept] = await db.checklistItems.toArray();
  expect(kept?.text).toBe('여권');
  expect(
    ChecklistItemSchema.safeParse({
      ...row,
      id: row.id.replace('9', '8'),
      list: 'essentials',
      text: 'JP:arrival',
    }).success,
  ).toBe(true);
  db.close();
});
