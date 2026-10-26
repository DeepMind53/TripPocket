import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { savedPlaceRepo } from '../../data/repositories/savedPlaceRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { Toaster } from '../../shared/ui';

afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ status: 'unknown', me: null });
});

it('장소 찾기: 카테고리 → 결과 → 가고 싶은 곳에 담기·저장, 저장 탭에 보임', async () => {
  await resetLocalDb();
  const trip = await tripRepo.create({
    title: '성수',
    destinations: [
      { name: '서울', kind: 'city', countryCode: 'KR', coords: { lat: 37.56, lng: 126.97 } },
    ],
    startDate: '2099-11-01',
    endDate: '2099-11-02',
    timezone: 'Asia/Seoul',
    cover: {},
  });
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  const bodies: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/places/search') {
      bodies.push(String(init?.body));
      return Response.json({
        places: [
          {
            source: 'kakao',
            id: '1',
            name: '어니언 성수',
            address: '서울 성동구',
            coords: { lat: 37.54, lng: 127.05 },
            category: '카페',
          },
        ],
        google: false,
      });
    }
    return Response.json({}, { status: 404 });
  });
  const user = userEvent.setup();
  render(
    <>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/places`] })}
      />
      <Toaster />
    </>,
  );
  await user.click(await screen.findByRole('button', { name: '카페' }));
  expect(JSON.parse(bodies[0]!)).toMatchObject({ q: '서울 카페', scope: 'domestic' });
  await user.click(await screen.findByRole('button', { name: '어니언 성수 가고 싶은 곳에 담기' }));
  await user.click(screen.getByRole('button', { name: '어니언 성수 저장' }));
  await waitFor(async () => expect(await savedPlaceRepo.listActive()).toHaveLength(1));
  const [item] = await itemRepo.listByTrip(trip.id);
  expect(item).toMatchObject({
    date: null,
    kind: 'cafe',
    title: '어니언 성수',
    place: { coordsSource: 'kakao' },
  });
});

it('하트는 바로 저장(채운 하트)·다시 누르면 취소, [+]는 이 나라 여행이 여럿이면 골라서 가고 싶은 곳에', async () => {
  await resetLocalDb();
  const mk = (title: string, start: string, end: string, cc = 'JP') =>
    tripRepo.create({
      title,
      destinations: [
        { name: '도쿄', kind: 'city', countryCode: cc, coords: { lat: 35.68, lng: 139.69 } },
      ],
      startDate: start,
      endDate: end,
      timezone: 'Asia/Tokyo',
      cover: {},
    });
  const a = await mk('도쿄 봄', '2099-04-01', '2099-04-03');
  const b = await mk('도쿄 가을', '2099-10-01', '2099-10-03');
  await mk('지난 도쿄', '2020-01-01', '2020-01-02');
  await mk('타이베이', '2099-05-01', '2099-05-02', 'TW');
  useAuth.setState({
    status: 'user',
    me: { id: 'u', nickname: 'n', createdAt: '', providers: [] },
  });
  vi.stubGlobal('fetch', async (url: string) =>
    url === '/api/places/search'
      ? Response.json({
          places: [
            {
              source: 'kakao',
              id: '9',
              name: '이치란',
              address: '도쿄 시부야',
              coords: { lat: 35.66, lng: 139.7 },
            },
          ],
          google: false,
        })
      : Response.json({}, { status: 404 }),
  );
  const user = userEvent.setup();
  render(
    <>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [`/trips/${a.id}/places`] })}
      />
      <Toaster />
    </>,
  );
  await user.click(await screen.findByRole('button', { name: '맛집' }));
  await user.click(await screen.findByRole('button', { name: '이치란 저장' }));
  const on = await screen.findByRole('button', { name: '이치란 저장 취소' });
  expect(on).toHaveAttribute('aria-pressed', 'true');
  expect(await savedPlaceRepo.listActive()).toHaveLength(1);
  await user.click(on);
  await waitFor(async () => expect(await savedPlaceRepo.listActive()).toHaveLength(0));

  // 도쿄로 가는 끝나지 않은 여행이 둘 → 골라서 그 여행의 가고 싶은 곳에
  await user.click(screen.getByRole('button', { name: '이치란 가고 싶은 곳에 담기' }));
  const sheet = await screen.findByRole('dialog', { name: '어느 여행에 담을까요?' });
  expect(within(sheet).queryByText('지난 도쿄')).not.toBeInTheDocument();
  expect(within(sheet).queryByText('타이베이')).not.toBeInTheDocument();
  await user.click(within(sheet).getByRole('button', { name: /도쿄 가을/ }));
  await waitFor(async () => expect(await itemRepo.listByTrip(b.id)).toHaveLength(1));
  expect((await itemRepo.listByTrip(b.id))[0]).toMatchObject({ date: null, title: '이치란' });
  expect(await itemRepo.listByTrip(a.id)).toHaveLength(0);
});
