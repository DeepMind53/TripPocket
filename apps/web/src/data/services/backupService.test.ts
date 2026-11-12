import { parseBackup } from '@trippocket/shared';
import { db } from '../db';
import { resetLocalDb } from '../dev';
import { tripRepo, type NewTrip } from '../repositories/tripRepo';
import { base64ToBytes, bytesToBase64, createBackup, restoreBackup } from './backupService';

const tokyo: NewTrip = {
  title: '도쿄 가을여행',
  destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
  startDate: '2026-10-24',
  endDate: '2026-10-28',
  timezone: 'Asia/Tokyo',
  cover: { emoji: '🗼' },
};

const ok = (text: string) => {
  const p = parseBackup(text);
  if (!p.ok) throw new Error(p.reason);
  return p;
};

beforeEach(async () => {
  await resetLocalDb();
});

describe('백업·복원', () => {
  it('만든 백업으로 전체 교체하면 그대로 돌아온다 (캐시는 백업하지 않음)', async () => {
    const trip = await tripRepo.create(tokyo);
    await db.settings.put({ key: 'settings', value: { theme: 'dark' } });
    await db.settings.put({ key: 'holidays:KR:2026', value: { fetchedAt: 1, value: [] } });
    const file = await createBackup();
    expect(file.data.settings).toEqual([{ key: 'settings', value: { theme: 'dark' } }]);
    expect(file.data.trips?.[0]).not.toHaveProperty('dirty');

    await tripRepo.create({ ...tokyo, title: '제주' });
    const parsed = ok(JSON.stringify(file));
    expect(parsed.counts.trips).toBe(1);
    await restoreBackup(parsed, 'replace');

    const trips = await tripRepo.listActive();
    expect(trips.map((t) => t.id)).toEqual([trip.id]);
    // 캐시는 지우지 않는다
    expect(await db.settings.get('holidays:KR:2026')).toBeDefined();
    // 복원한 행은 동기화 대상
    expect((await db.trips.get(trip.id))?.dirty).toBe(1);
  });

  it('병합: 같은 여행은 더 최근에 고친 쪽, 없는 여행은 추가', async () => {
    const trip = await tripRepo.create(tokyo);
    const file = await createBackup();
    await tripRepo.update(trip.id, { title: '도쿄 (나중에 고침)' });
    const other = await tripRepo.create({ ...tokyo, title: '오사카' });
    await db.trips.delete(other.id);

    const extra = { ...(file.data.trips?.[0] as object), id: other.id, title: '오사카' };
    file.data.trips = [...(file.data.trips ?? []), extra];
    await restoreBackup(ok(JSON.stringify(file)), 'merge');

    const titles = (await tripRepo.listActive()).map((t) => t.title).sort();
    expect(titles).toEqual(['도쿄 (나중에 고침)', '오사카']);
  });

  it('백업 파일이 아니거나 형식이 틀리면 거부, 새 버전 파일도 거부', async () => {
    expect(parseBackup('nope')).toEqual({ ok: false, reason: 'notJson' });
    expect(parseBackup('{"a":1}')).toEqual({ ok: false, reason: 'notBackup' });
    const file = await createBackup();
    expect(parseBackup(JSON.stringify({ ...file, schemaVersion: 99 }))).toEqual({
      ok: false,
      reason: 'tooNew',
    });
    expect(
      parseBackup(JSON.stringify({ ...file, data: { trips: [{ id: 'x', title: 1 }] } })),
    ).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('여행 파일 내보내기 (공유 → 파일)', () => {
  it('그 여행의 일정·예약·준비물이 하나도 빠지지 않고, 다른 기기에서 합치기로 그대로 돌아온다', async () => {
    const { seedSampleTrip } = await import('../dev');
    const { createTripBackup } = await import('./backupService');
    const tripId = await seedSampleTrip();
    const other = await tripRepo.create({ ...tokyo, title: '다른 여행' });
    const { itemRepo } = await import('../repositories/itemRepo');
    const { bookingRepo } = await import('../repositories/bookingRepo');
    await itemRepo.create({ tripId: other.id, date: null, kind: 'place', title: '다른 여행 일정' });
    await bookingRepo.create({
      tripId,
      kind: 'flight',
      title: 'KE703',
      start: { date: '2026-10-27', time: '09:10' },
    });
    const count = async () => ({
      items: await db.items.where('tripId').equals(tripId).count(),
      bookings: await db.bookings.where('tripId').equals(tripId).count(),
      checklist: await db.checklistItems.where('tripId').equals(tripId).count(),
    });
    const before = await count();
    expect(before.items).toBeGreaterThan(0);

    const file = await createTripBackup(tripId);
    expect(file.data.trips).toHaveLength(1);
    expect(file.data.items).toHaveLength(before.items);
    expect(file.data.bookings).toHaveLength(before.bookings);
    expect(file.data.checklistItems).toHaveLength(before.checklist);

    await resetLocalDb(); // 받는 사람 기기
    await restoreBackup(ok(JSON.stringify(file)), 'merge');
    expect(await count()).toEqual(before);
    expect(await db.items.where('tripId').equals(other.id).count()).toBe(0);
  });
});

describe('백업 — 사진·영수증 넣기 (2026-11-13)', () => {
  const photo = (id: string) => ({
    id,
    tripId: 't1',
    itemId: 'i1',
    kind: 'receipt' as const,
    blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }),
    createdAt: '2026-11-13T00:00:00.000Z',
    text: '커피 4,500',
    textSource: 'device' as const,
  });

  it('기본은 사진을 넣지 않고, 켜면 넣어서 복원하면 그대로 돌아온다', async () => {
    await db.photos.add(photo('p1'));
    expect((await createBackup()).data).not.toHaveProperty('photos');

    const file = await createBackup({ photos: true });
    const parsed = ok(JSON.stringify(file));
    expect(parsed.photos).toHaveLength(1);
    expect(parsed.photos[0]!.image.startsWith('data:image/jpeg;base64,')).toBe(true);

    await db.photos.clear();
    await restoreBackup(parsed, 'merge');
    const back = await db.photos.get('p1');
    expect(back?.text).toBe('커피 4,500');
    expect(back?.textSource).toBe('device');
    // 바이트 변환은 아래 시험에서 (시험 DB fake-indexeddb는 Blob 내용을 복제하지 못한다)
    expect(back?.blob).toBeDefined();
  });

  it('바이트 ⇄ base64는 그대로 돌아온다 (큰 사진도)', () => {
    const big = new Uint8Array(100_000).map((_, i) => (i * 7) % 256);
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
    expect(bytesToBase64(new Uint8Array([1, 2, 3, 250]))).toBe('AQID+g==');
  });

  it('사진 없는 파일로 전체 바꾸기를 해도 이 기기 사진은 남는다', async () => {
    await db.photos.add(photo('p1'));
    await restoreBackup(ok(JSON.stringify(await createBackup())), 'replace');
    expect(await db.photos.count()).toBe(1);
  });

  it('예전 파일(사진 칸 없음)은 빈 사진으로, 형식이 틀린 사진은 거부', () => {
    const base = { format: 'trippocket-backup', schemaVersion: 1, exportedAt: 'x', data: {} };
    expect(ok(JSON.stringify(base)).photos).toEqual([]);
    const bad = { ...base, data: { photos: [{ id: 'p', image: 'javascript:1' }] } };
    expect(parseBackup(JSON.stringify(bad))).toEqual({ ok: false, reason: 'invalid' });
  });
});
