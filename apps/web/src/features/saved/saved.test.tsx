import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { savedPlaceRepo } from '../../data/repositories/savedPlaceRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

beforeEach(async () => {
  await resetLocalDb();
});

it('저장한 장소: 도시 묶음을 다가오는 여행의 "가고 싶은 곳"으로 한 번에 담는다 (docs/16 E2)', async () => {
  const trip = await tripRepo.create({
    timezone: 'Asia/Tokyo',
    cover: {},
    title: '도쿄 여행',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2099-01-01',
    endDate: '2099-01-03',
  });
  await tripRepo.create({
    timezone: 'Asia/Seoul',
    cover: {},
    title: '지난 여행',
    destinations: [{ name: '부산', kind: 'city', countryCode: 'KR' }],
    startDate: '2020-01-01',
    endDate: '2020-01-02',
  });
  for (const name of ['스시 잔마이', '블루보틀'])
    await savedPlaceRepo.create({ name, kind: 'food', cityTag: '도쿄', address: '도쿄' });

  const user = userEvent.setup();
  render(
    <>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/saved'] })} />
      <Toaster />
    </>,
  );
  await user.click(await screen.findByRole('button', { name: '도쿄 저장 장소를 여행에 담기' }));
  expect(screen.queryByRole('button', { name: /지난 여행/ })).not.toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: /도쿄 여행/ }));
  expect(await screen.findByText('도쿄 여행에 2곳을 담았어요')).toBeInTheDocument();
  const items = await itemRepo.listByTrip(trip.id);
  expect(items.map((i) => [i.title, i.date]).sort()).toEqual([
    ['블루보틀', null],
    ['스시 잔마이', null],
  ]);
});
