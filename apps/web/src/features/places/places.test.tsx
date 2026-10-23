import { render, screen, waitFor } from '@testing-library/react';
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
    startDate: '2026-11-01',
    endDate: '2026-11-02',
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
