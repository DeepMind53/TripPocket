import { db } from '../db';
import { resetLocalDb } from '../dev';
import { dayNoteRepo } from './dayNoteRepo';
import { itemRepo } from './itemRepo';
import { tripRepo } from './tripRepo';

beforeEach(async () => {
  await resetLocalDb();
});

const setup = async () => {
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [],
    startDate: '2026-10-24',
    endDate: '2026-10-25',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  const item = await itemRepo.create({
    tripId: trip.id,
    date: '2026-10-24',
    kind: 'place',
    title: '센소지',
  });
  return { trip, item };
};

describe('내 기록 (2026-11-25): 방문 표시·하루 한 줄은 계정마다 따로', () => {
  it('방문·다녀옴은 일정이 아니라 내 기록에 저장되고, 읽을 때 일정에 덮어 쓴다', async () => {
    const { item } = await setup();
    await itemRepo.update(item.id, { done: true });
    const row = await db.items.get(item.id);
    expect(row).not.toHaveProperty('done');
    expect(row).not.toHaveProperty('visit');
    expect(await itemRepo.get(item.id)).toMatchObject({ done: true, visit: 'visited' });
    const marks = await db.itemMarks.toArray();
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ itemId: item.id, visit: 'visited', done: true, dirty: 1 });
    expect((await itemRepo.listVisited()).map((i) => i.id)).toEqual([item.id]);
    // 기록 지우기
    await itemRepo.setVisit(item.id, null);
    const after = await itemRepo.get(item.id);
    expect(after?.visit).toBeUndefined();
    expect(after?.done).toBeUndefined();
    expect(await itemRepo.listVisited()).toEqual([]);
  });

  it('일정 행에 남은 예전·일행 표시는 무시한다', async () => {
    const { item } = await setup();
    await db.items.update(item.id, { visit: 'visited', done: true });
    const got = await itemRepo.get(item.id);
    expect(got?.visit).toBeUndefined();
    expect(got?.done).toBeUndefined();
  });

  it('방문 표시와 다른 칸을 함께 고치면 둘 다 반영된다', async () => {
    const { item } = await setup();
    const out = await itemRepo.update(item.id, { visit: 'skipped', memo: '비' });
    expect(out).toMatchObject({ visit: 'skipped', memo: '비' });
    expect(await db.items.get(item.id)).not.toHaveProperty('visit');
  });

  it('하루 한 줄: 날짜마다 한 줄, 빈 글이면 지운다', async () => {
    const { trip } = await setup();
    await dayNoteRepo.set(trip.id, '2026-10-24', '  좋았다\n정말 ');
    await dayNoteRepo.set(trip.id, '2026-10-24', '좋았다 정말');
    expect((await dayNoteRepo.listByTrip(trip.id)).map((n) => n.text)).toEqual(['좋았다 정말']);
    await dayNoteRepo.set(trip.id, '2026-10-24', '  ');
    expect(await dayNoteRepo.listAll()).toEqual([]);
  });
});
