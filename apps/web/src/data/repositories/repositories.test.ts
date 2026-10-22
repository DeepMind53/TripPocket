import { db } from '../db';
import { resetLocalDb } from '../dev';
import { itemRepo } from './itemRepo';
import { tripRepo, type NewTrip } from './tripRepo';

const tokyo: NewTrip = {
  title: '도쿄 가을여행',
  destinations: ['도쿄'],
  startDate: '2026-10-24',
  endDate: '2026-10-28',
  timezone: 'Asia/Tokyo',
  cover: { emoji: '🗼' },
};

beforeEach(async () => {
  await resetLocalDb();
});

describe('tripRepo', () => {
  it('만들면 저장되고 시작일 순으로 나온다', async () => {
    await tripRepo.create({
      ...tokyo,
      title: '제주',
      startDate: '2026-12-01',
      endDate: '2026-12-03',
    });
    await tripRepo.create(tokyo);
    const trips = await tripRepo.listActive();
    expect(trips.map((t) => t.title)).toEqual(['도쿄 가을여행', '제주']);
    // 로컬 전용 필드는 밖으로 나가지 않는다
    expect(trips[0]).not.toHaveProperty('dirty');
  });

  it('검증에 실패하면 저장하지 않는다', async () => {
    await expect(tripRepo.create({ ...tokyo, endDate: '2026-10-20' })).rejects.toThrow();
    expect(await db.trips.count()).toBe(0);
  });

  it('수정하면 updatedAt이 바뀌고 동기화 대기(dirty)로 표시된다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
    const trip = await tripRepo.create(tokyo);
    vi.setSystemTime(new Date('2026-10-22T11:00:00Z'));
    const updated = await tripRepo.update(trip.id, { title: '도쿄 4박 5일' });
    vi.useRealTimers();

    expect(updated.title).toBe('도쿄 4박 5일');
    expect(updated.updatedAt).toBe('2026-10-22T11:00:00.000Z');
    expect(updated.createdAt).toBe('2026-10-22T10:00:00.000Z');
    expect((await db.trips.get(trip.id))?.dirty).toBe(1);
  });

  it('삭제는 휴지통으로 가고 되돌릴 수 있다', async () => {
    const trip = await tripRepo.create(tokyo);
    await tripRepo.softDelete(trip.id);
    expect(await tripRepo.listActive()).toHaveLength(0);
    expect(await tripRepo.get(trip.id)).toBeUndefined();
    expect(await db.trips.count()).toBe(1);

    await tripRepo.restore(trip.id);
    expect(await tripRepo.get(trip.id)).toBeDefined();
  });
});

describe('itemRepo', () => {
  async function setup() {
    const trip = await tripRepo.create(tokyo);
    const add = (title: string, date: string | null = '2026-10-25') =>
      itemRepo.create({ tripId: trip.id, date, kind: 'place', title });
    return { trip, add };
  }

  it('같은 날 추가하면 뒤에 붙는다', async () => {
    const { trip, add } = await setup();
    await add('센소지');
    await add('이치란 라멘');
    await add('긴자');
    const titles = (await itemRepo.listByDay(trip.id, '2026-10-25')).map((i) => i.title);
    expect(titles).toEqual(['센소지', '이치란 라멘', '긴자']);
  });

  it('같은 날 안에서 순서를 바꾸면 옮긴 일정 하나만 저장된다', async () => {
    const { trip, add } = await setup();
    const a = await add('A');
    const b = await add('B');
    const c = await add('C');
    await itemRepo.move(c.id, '2026-10-25', 0);

    expect((await itemRepo.listByDay(trip.id, '2026-10-25')).map((i) => i.title)).toEqual([
      'C',
      'A',
      'B',
    ]);
    expect((await itemRepo.get(a.id))?.order).toBe(a.order);
    expect((await itemRepo.get(b.id))?.order).toBe(b.order);
  });

  it('다른 날·가고 싶은 곳으로 옮길 수 있다', async () => {
    const { trip, add } = await setup();
    const a = await add('A');
    await add('X', '2026-10-26');
    await add('Y', '2026-10-26');
    await itemRepo.move(a.id, '2026-10-26', 1);
    expect((await itemRepo.listByDay(trip.id, '2026-10-26')).map((i) => i.title)).toEqual([
      'X',
      'A',
      'Y',
    ]);

    await itemRepo.move(a.id, null, 0);
    expect((await itemRepo.listByDay(trip.id, null)).map((i) => i.title)).toEqual(['A']);
    // 전체 목록에서 가고 싶은 곳은 맨 뒤
    expect((await itemRepo.listByTrip(trip.id)).map((i) => i.title)).toEqual(['X', 'Y', 'A']);
  });

  it('정렬 키가 겹친 경우 그날 전체를 다시 매긴다', async () => {
    const { trip, add } = await setup();
    const a = await add('A');
    const b = await add('B');
    const c = await add('C');
    // 다른 기기에서 동시에 같은 키가 생긴 상황을 흉내
    await db.items.update(b.id, { order: a.order });
    await itemRepo.move(c.id, '2026-10-25', 1);
    const list = await itemRepo.listByDay(trip.id, '2026-10-25');
    expect(list.map((i) => i.title)).toEqual(['A', 'C', 'B']);
    expect(new Set(list.map((i) => i.order)).size).toBe(3);
  });

  it('삭제한 일정은 목록에서 빠지고 되돌릴 수 있다', async () => {
    const { trip, add } = await setup();
    const a = await add('A');
    await itemRepo.softDelete(a.id);
    expect(await itemRepo.listByTrip(trip.id)).toHaveLength(0);
    await itemRepo.restore(a.id);
    expect(await itemRepo.listByTrip(trip.id)).toHaveLength(1);
  });

  it('잘못된 시간 형식은 거부한다', async () => {
    const { trip } = await setup();
    await expect(
      itemRepo.create({
        tripId: trip.id,
        date: '2026-10-25',
        kind: 'food',
        title: 'A',
        startTime: '9시',
      }),
    ).rejects.toThrow();
  });
});
