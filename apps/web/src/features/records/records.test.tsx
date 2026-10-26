import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { tripRepo } from '../../data/repositories/tripRepo';
import { itemRepo } from '../../data/repositories/itemRepo';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { setLab } from '../../data/labsStore';

beforeEach(async () => {
  await resetLocalDb();
});

it('기록 탭: 다녀온 여행만 모으고 횟수·여행한 날·가 본 나라를 센다', async () => {
  const base = { timezone: 'Asia/Seoul', cover: {} } as const;
  await tripRepo.create({
    ...base,
    title: '오사카',
    destinations: [{ name: '오사카', kind: 'city', countryCode: 'JP' }],
    startDate: '2025-05-01',
    endDate: '2025-05-03',
  });
  await tripRepo.create({
    ...base,
    title: '타이베이',
    destinations: [{ name: '타이베이', kind: 'city', countryCode: 'TW' }],
    startDate: '2025-08-10',
    endDate: '2025-08-11',
  });
  await tripRepo.create({
    ...base,
    title: '미래 여행',
    destinations: [{ name: '파리', kind: 'city', countryCode: 'FR' }],
    startDate: '2099-01-01',
    endDate: '2099-01-02',
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/records'] })} />);
  const stats = await screen.findByRole('region', { name: '나의 여행' });
  expect(await within(stats).findByText('2번')).toBeInTheDocument();
  expect(within(stats).getByText('5일')).toBeInTheDocument(); // 3일 + 2일
  expect(within(stats).getByText('2곳')).toBeInTheDocument();
  expect(await screen.findByText('오사카')).toBeInTheDocument();
  expect(screen.queryByText('미래 여행')).not.toBeInTheDocument();
});

it('실험실 여행 회고: 걸은 거리·비행기 탑승·가장 많이 간 나라 카드', async () => {
  setLab('travelReview', true);
  const trip = await tripRepo.create({
    timezone: 'Asia/Tokyo',
    cover: {},
    title: '도쿄',
    destinations: [
      { name: '도쿄', kind: 'city', countryCode: 'JP', coords: { lat: 35.68, lng: 139.76 } },
    ],
    startDate: '2025-05-01',
    endDate: '2025-05-03',
  });
  for (const [title, lat] of [
    ['센소지', 35.7148],
    ['우에노', 35.7141],
  ] as const)
    await itemRepo.create({
      tripId: trip.id,
      date: '2025-05-02',
      kind: 'place',
      title,
      place: { name: title, coords: { lat, lng: 139.7967 } },
    });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: 'KE703',
    start: { date: '2025-05-01', time: '09:10', place: 'ICN' },
    end: { date: '2025-05-01', time: '11:30', place: 'NRT' },
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/records'] })} />);
  const review = await screen.findByRole('region', { name: '여행 회고' });
  expect(within(review).getByText('비행기 탑승').parentElement).toHaveTextContent('1번');
  expect(within(review).getByText('가장 많이 간 나라').parentElement).toHaveTextContent('일본');
  expect(within(review).getByText('걸은 거리').parentElement).toHaveTextContent('0.1km');
  setLab('travelReview', false);
});
