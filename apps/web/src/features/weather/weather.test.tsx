import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { tripRepo } from '../../data/repositories/tripRepo';

beforeEach(async () => {
  await resetLocalDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('날씨 정보: 여행 앞뒤 하루까지 목적지 날씨, 항공편 출발 공항 날씨', async () => {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    const days = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
    return Response.json({
      daily: {
        time: days,
        weather_code: days.map(() => 0),
        temperature_2m_max: days.map(() => (url.includes('latitude=37') ? 18 : 22)),
        temperature_2m_min: days.map(() => 10),
      },
    });
  });
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [
      { name: '도쿄', kind: 'city', countryCode: 'JP', coords: { lat: 35.68, lng: 139.69 } },
    ],
    startDate: '2026-10-24',
    endDate: '2026-10-26',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: 'KE703',
    start: { date: '2026-10-24', time: '09:10', place: 'ICN' },
    end: { date: '2026-10-24', time: '11:30', place: 'NRT' },
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/weather`] })}
    />,
  );
  const dest = await screen.findByRole('region', { name: '여행지 · 도쿄' });
  const rows = within(dest).getAllByRole('listitem');
  expect(rows).toHaveLength(5);
  expect(rows[0]).toHaveTextContent('여행 전날');
  expect(rows[4]).toHaveTextContent('여행 다음 날');
  expect(await within(dest).findAllByText('10°/22°')).toHaveLength(5);
  const air = screen.getByRole('region', { name: '출발 공항 날씨' });
  expect(within(air).getByText(/ICN/)).toBeInTheDocument();
  expect(await within(air).findByText('10°/18°')).toBeInTheDocument();
});

it('여행지 특이사항: 나라 코드만 보내고, 특보와 그 나라 기상청 링크를 보여 준다', async () => {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    if (url.includes('/api/alerts'))
      return Response.json({
        alerts: [
          {
            id: 'gdacs-TC-1-JP',
            country: 'JP',
            kind: 'cyclone',
            level: 'red',
            title: 'Tropical Cyclone CHAMPI-26',
            source: 'gdacs',
            url: 'https://www.gdacs.org/report.aspx?eventid=1',
          },
          {
            id: 'mofa-JP-3',
            country: 'JP',
            kind: 'travel',
            level: 'red',
            title: '일본',
            step: 3,
            area: '후쿠시마 원전 반경 30km 이내',
            whole: false,
            source: 'mofa',
            url: 'https://www.0404.go.kr/',
          },
        ],
        checkedAt: '2026-10-22T03:00:00Z',
        missing: [],
      });
    return Response.json({});
  });
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [
      { name: '도쿄', kind: 'city', countryCode: 'JP', coords: { lat: 35.68, lng: 139.69 } },
    ],
    startDate: '2026-10-24',
    endDate: '2026-10-26',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/weather`] })}
    />,
  );
  const box = await screen.findByRole('region', { name: '여행지 특이사항' });
  expect(await within(box).findByText('🌀 태풍 · 빨강 경보')).toBeInTheDocument();
  expect(within(box).getByText('Tropical Cyclone CHAMPI-26')).toBeInTheDocument();
  expect(within(box).getByText('🛂 여행경보 3단계')).toBeInTheDocument();
  expect(within(box).getByText('후쿠시마 원전 반경 30km 이내')).toBeInTheDocument();
  expect(within(box).getByRole('link', { name: /일본 기상청 경보·주의보/ })).toHaveAttribute(
    'href',
    'https://www.jma.go.jp/bosai/warning/',
  );
  const alertUrl = urls.find((u) => u.includes('/api/alerts'))!;
  expect(alertUrl).toContain('countries=JP');
  expect(alertUrl).not.toMatch(/lat|lng|35\.68/);
});
