import { addDays, todayIn } from '@trippocket/shared';
import { db } from './db';
import { itemRepo } from './repositories/itemRepo';
import { tripRepo } from './repositories/tripRepo';

// 개발·테스트 전용 도우미. 실제 화면에서 쓰지 않는다.

/** 기기 저장소 전체 비우기 */
export async function resetLocalDb(): Promise<void> {
  await db.delete();
  await db.open();
}

/** 3일 뒤 출발하는 도쿄 4박 5일 샘플 여행 (한 트랜잭션: 전부 저장되거나 전부 취소) */
export function seedSampleTrip(): Promise<string> {
  return db.transaction('rw', db.trips, db.items, seedInTransaction);
}

async function seedInTransaction(): Promise<string> {
  const start = addDays(todayIn('Asia/Tokyo'), 3);
  const trip = await tripRepo.create({
    title: '도쿄 가을여행',
    destinations: ['도쿄'],
    startDate: start,
    endDate: addDays(start, 4),
    timezone: 'Asia/Tokyo',
    cover: { emoji: '🗼', color: '#2F6BFF' },
  });
  const day1 = start;
  const day2 = addDays(start, 1);
  const samples = [
    { date: day1, kind: 'transport', title: '인천 → 나리타 KE703', startTime: '09:10' },
    { date: day1, kind: 'lodging', title: '신주쿠 그레이스리 호텔 체크인', startTime: '15:00' },
    { date: day2, kind: 'place', title: '센소지', startTime: '09:00' },
    { date: day2, kind: 'food', title: '이치란 라멘', startTime: '11:30' },
    { date: day2, kind: 'shopping', title: '긴자 쇼핑' },
    { date: null, kind: 'cafe', title: '블루보틀 기요스미' },
  ] as const;
  for (const s of samples) {
    await itemRepo.create({ tripId: trip.id, ...s });
  }
  return trip.id;
}
