import { parseBackup } from '@trippocket/shared';
import { db } from '../db';
import { resetLocalDb } from '../dev';
import { tripRepo, type NewTrip } from '../repositories/tripRepo';
import { createBackup, restoreBackup } from './backupService';

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
