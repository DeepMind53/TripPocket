import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { db } from '../../data/db';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { trashRepo } from '../../data/repositories/trashRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { acceptDelete } from '../../test/confirm';

beforeEach(async () => {
  await resetLocalDb();
});

const mkTrip = (title: string) =>
  tripRepo.create({
    title,
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2099-01-01',
    endDate: '2099-01-02',
    timezone: 'Asia/Tokyo',
    cover: {},
  });

describe('삭제 기록 복원', () => {
  it('여행은 통째로, 일정은 하나씩 되살린다', async () => {
    const gone = await mkTrip('지운 여행');
    const a = await itemRepo.create({
      tripId: gone.id,
      date: '2099-01-01',
      kind: 'place',
      title: '센소지',
    });
    await itemRepo.softDelete(a.id);
    await tripRepo.softDelete(gone.id);
    const keep = await mkTrip('남은 여행');
    const b = await itemRepo.create({
      tripId: keep.id,
      date: '2099-01-01',
      kind: 'food',
      title: '라멘',
    });
    await itemRepo.softDelete(b.id);

    const user = userEvent.setup();
    render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/me/trash'] })} />,
    );
    const trips = await screen.findByRole('region', { name: '여행 전체' });
    expect(trips).toHaveTextContent('지운 여행');
    const inTrip = screen.getByRole('region', { name: '일정·예약·준비물' });
    expect(inTrip).toHaveTextContent('라멘');
    // 지운 여행 안의 일정은 따로 보이지 않는다 (여행과 함께 되살린다)
    expect(inTrip).not.toHaveTextContent('센소지');

    await user.click(within(trips).getByRole('button', { name: '지운 여행 복원' }));
    await waitFor(async () => expect((await tripRepo.get(gone.id))?.deletedAt).toBeUndefined());
    expect((await itemRepo.get(a.id))?.title).toBe('센소지');

    await user.click(within(inTrip).getByRole('button', { name: '라멘 복원' }));
    await waitFor(async () => expect((await itemRepo.get(b.id))?.title).toBe('라멘'));
  });

  it('7일 넘은 삭제 기록은 목록에 없고, 올린 것은 기기에서 정리된다', async () => {
    const t = await mkTrip('오래된 여행');
    const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
    await db.trips.update(t.id, { deletedAt: old, dirty: 0 });
    expect(await trashRepo.list()).toEqual([]);
    expect(await trashRepo.purge()).toBe(1);
    expect(await db.trips.get(t.id)).toBeUndefined();
  });

  it('삭제는 한 번 더 묻고, 취소하면 그대로', async () => {
    const t = await mkTrip('도쿄');
    const user = userEvent.setup();
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [`/trips/${t.id}/settings`] })}
      />,
    );
    await user.click(await screen.findByRole('button', { name: '여행 삭제' }));
    const dialog = await screen.findByRole('dialog', { name: '삭제할까요?' });
    expect(dialog).toHaveTextContent('7일 안에는 복원할 수 있어요');
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    expect((await tripRepo.get(t.id))?.deletedAt).toBeUndefined();
    await user.click(screen.getByRole('button', { name: '여행 삭제' }));
    await acceptDelete(user);
    await waitFor(async () => expect(await tripRepo.get(t.id)).toBeUndefined());
  });
});
