import Dexie from 'dexie';
import { TripPocketDB } from '../db';

const NAME = 'migration-v10-test';
afterEach(async () => {
  await Dexie.delete(NAME);
});

it('저장소 v9 → v10: 예전 예약(장소 좌표·차량번호 없음)도 그대로 읽힌다', async () => {
  const old = new Dexie(NAME);
  old.version(9).stores({ bookings: 'id, tripId, [tripId+kind], updatedAt, dirty' });
  await old.table('bookings').add({
    id: 'b',
    tripId: 't',
    kind: 'car',
    title: '렌터카',
    start: { date: '2026-11-03', place: '나하 공항' },
    dirty: 0,
  });
  old.close();
  const db = new TripPocketDB(NAME);
  expect(db.verno).toBeGreaterThanOrEqual(10);
  const row = await db.bookings.get('b');
  expect(row).toMatchObject({ title: '렌터카', start: { place: '나하 공항' } });
  expect(row?.start.coords).toBeUndefined();
  expect(row?.details?.plate).toBeUndefined();
  db.close();
});
