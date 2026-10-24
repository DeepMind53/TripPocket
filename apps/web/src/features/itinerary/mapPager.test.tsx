import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type * as Maps from '../../shared/maps';
import type { LatLng, MapHandle } from '../../shared/maps';
import { resetUsageFlags } from '../../data/api/usage';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';

// 실제 지도 SDK 대신: 옮겨 간 핀만 기록
const panned: LatLng[] = [];
vi.mock('../../shared/maps', async (orig) => {
  const real = await orig<typeof Maps>();
  return {
    ...real,
    chooseProvider: () => 'google' as const,
    mountMap: async (): Promise<MapHandle> => ({
      setMarkers: () => {},
      drawPaths: () => {},
      fitBounds: () => {},
      panTo: (p) => void panned.push(p),
      resize: () => {},
      onMarkerClick: () => {},
      destroy: () => {},
    }),
  };
});
const { routes } = await import('../../app/router');

let tripId = '';
beforeEach(async () => {
  await resetLocalDb();
  resetUsageFlags();
  panned.length = 0;
  vi.stubGlobal('fetch', async () => Response.json({ maps: true }));
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  tripId = trip.id;
  const at = (lat: number) => ({ name: 'x', coords: { lat, lng: 139.7 } });
  await itemRepo.create({
    tripId,
    date: '2026-11-01',
    kind: 'place',
    title: '센소지',
    place: at(35.71),
  });
  await itemRepo.create({
    tripId,
    date: '2026-11-02',
    kind: 'food',
    title: '이치란',
    place: at(35.69),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('지도를 누르면 크게 보고, 아래 일정은 하나씩 넘기며 지도가 그 핀으로 간다', async () => {
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${tripId}/plan?day=all`] })}
    />,
  );
  await user.click(await screen.findByRole('button', { name: '지도' }));
  await user.click(await screen.findByRole('button', { name: '지도 크게 보기' }));
  const pager = await screen.findByRole('region', { name: '지도에서 보는 일정' });
  expect(within(pager).getByText('1 / 2')).toBeInTheDocument();
  expect(within(pager).getByText('센소지')).toBeInTheDocument();
  // 크게 볼 때는 일차별 목록 대신 카드 하나
  expect(screen.queryByRole('region', { name: /2일차/ })).not.toBeInTheDocument();
  await user.click(within(pager).getByRole('button', { name: '다음 일정' }));
  expect(within(pager).getByText('이치란')).toBeInTheDocument();
  expect(panned.at(-1)).toEqual({ lat: 35.69, lng: 139.7 });
  await user.click(screen.getByRole('button', { name: '작게' }));
  expect(screen.queryByRole('region', { name: '지도에서 보는 일정' })).not.toBeInTheDocument();
});
