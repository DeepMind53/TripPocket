import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { tripRepo } from '../../data/repositories/tripRepo';

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
