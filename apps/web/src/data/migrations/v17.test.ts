import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v17-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v16 → v17: 아직 안 올린 내 방문 표시·하루 한 줄만 내 기록으로, 받은 것은 지운다(서버가 주인 것으로 옮겨 내려줌)', async () => {
  const old = new Dexie(NAME);
  old.version(16).stores({
    trips: 'id, startDate, updatedAt, dirty',
    items: 'id, tripId, [tripId+date], updatedAt, dirty',
  });
  await old.table('items').bulkAdd([
    {
      id: 'a',
      tripId: 't',
      date: '2026-10-24',
      title: '센소지',
      visit: 'visited',
      done: true,
      dirty: 1,
    },
    { id: 'b', tripId: 't', date: '2026-10-24', title: '라멘', visit: 'skipped', dirty: 0 },
    { id: 'c', tripId: 't', date: '2026-10-24', title: '공원', dirty: 1 },
  ]);
  await old.table('trips').bulkAdd([
    { id: 't', title: '도쿄', dayNotes: [{ date: '2026-10-24', text: '좋았다' }], dirty: 1 },
    { id: 'u', title: '오사카', dayNotes: [{ date: '2026-10-25', text: '남의 기록' }], dirty: 0 },
  ]);
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(17);
  for (const id of ['a', 'b', 'c']) {
    const row = await db.items.get(id);
    expect(row).not.toHaveProperty('visit');
    expect(row).not.toHaveProperty('done');
  }
  // 일정 행은 dirty를 바꾸지 않는다
  expect((await db.items.get('b'))?.dirty).toBe(0);
  const marks = await db.itemMarks.toArray();
  expect(marks).toHaveLength(1);
  expect(marks[0]).toMatchObject({
    tripId: 't',
    itemId: 'a',
    visit: 'visited',
    done: true,
    dirty: 1,
  });
  expect(await db.trips.get('t')).not.toHaveProperty('dayNotes');
  const notes = await db.dayNotes.toArray();
  expect(notes).toHaveLength(1);
  expect(notes[0]).toMatchObject({ tripId: 't', date: '2026-10-24', text: '좋았다', dirty: 1 });
  db.close();
});
