import { resetLocalDb } from '../dev';
import { db } from '../db';
import { photoRepo } from './photoRepo';
import { trashRepo } from './trashRepo';

beforeEach(resetLocalDb);

it('사진·영수증은 기기에만: 동기화 표시가 없고, 옮기기·글 고치기·지우기', async () => {
  const p = await photoRepo.add({
    tripId: 't',
    itemId: 'a',
    kind: 'receipt',
    blob: new Blob(['jpg'], { type: 'image/jpeg' }),
  });
  expect(p).not.toHaveProperty('dirty');
  await photoRepo.moveTo(p.id, 'b');
  expect(await photoRepo.listByItem('a')).toEqual([]);
  await photoRepo.setText(p.id, '라멘 980', 'google');
  expect((await photoRepo.listByItem('b'))[0]).toMatchObject({
    text: '라멘 980',
    textSource: 'google',
  });
  await photoRepo.remove(p.id);
  expect(await db.photos.count()).toBe(0);
});

it('휴지통 정리로 일정이 아예 지워지면 그 사진도 지운다', async () => {
  // reason: 정리 규칙만 보려고 최소한의 일정 줄을 바로 넣는다
  await db.items.add({ id: 'keep', tripId: 't', dirty: 0 } as never);
  await photoRepo.add({ tripId: 't', itemId: 'keep', kind: 'photo', blob: new Blob(['a']) });
  await photoRepo.add({ tripId: 't', itemId: 'gone', kind: 'photo', blob: new Blob(['b']) });
  await trashRepo.purge();
  expect((await db.photos.toArray()).map((p) => p.itemId)).toEqual(['keep']);
});
