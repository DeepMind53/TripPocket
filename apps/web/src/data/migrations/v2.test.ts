import Dexie from 'dexie';
import { TripSchema } from '@trippocket/shared';
import { TripPocketDB } from '../db';

const NAME = 'migration-v2-test';

afterEach(async () => {
  await Dexie.delete(NAME);
});

describe('저장소 v1 → v2', () => {
  it('문자열 목적지를 객체로 바꾸고, 결과가 스키마를 통과한다', async () => {
    // v1 형태로 저장
    const old = new Dexie(NAME);
    old.version(1).stores({ trips: 'id, startDate, updatedAt, dirty' });
    await old.table('trips').add({
      id: '0190f2a4-0000-7000-8000-000000000001',
      title: '예전 여행',
      destinations: ['도쿄', '하코네'],
      startDate: '2026-10-24',
      endDate: '2026-10-28',
      timezone: 'Asia/Tokyo',
      cover: {},
      createdAt: '2026-10-22T00:00:00.000Z',
      updatedAt: '2026-10-22T00:00:00.000Z',
      dirty: 0,
    });
    old.close();

    // 새 버전으로 열면 자동 변환
    const db = new TripPocketDB(NAME);
    const [trip] = await db.trips.toArray();
    expect(trip?.destinations).toEqual([
      { name: '도쿄', kind: 'custom' },
      { name: '하코네', kind: 'custom' },
    ]);
    expect(trip?.dirty).toBe(1);
    const { dirty: _d, ...domain } = trip as NonNullable<typeof trip>;
    expect(TripSchema.safeParse(domain).success).toBe(true);
    db.close();
  });
});
