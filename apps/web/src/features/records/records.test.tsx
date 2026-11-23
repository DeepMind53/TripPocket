import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { tripRepo } from '../../data/repositories/tripRepo';
import { itemRepo } from '../../data/repositories/itemRepo';
import { bookingRepo } from '../../data/repositories/bookingRepo';

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
});

async function seedVisits() {
  const mk = (title: string, start: string, coords: { lat: number; lng: number }) =>
    tripRepo.create({
      timezone: 'Asia/Tokyo',
      cover: {},
      title,
      destinations: [{ name: title.split(' ')[0]!, kind: 'city', countryCode: 'JP', coords }],
      startDate: start,
      endDate: start,
    });
  const a = await mk('오사카', '2025-05-01', { lat: 34.69, lng: 135.5 });
  const b = await mk('후쿠오카', '2025-08-01', { lat: 33.59, lng: 130.4 });
  const c = await mk('오사카 또', '2025-10-01', { lat: 34.69, lng: 135.5 });
  for (const [trip, title, v] of [
    [a, '오사카성', 'visited'],
    [a, '도톤보리', 'skipped'],
    [b, '캐널시티', 'visited'],
    [c, '오사카성', 'visited'],
  ] as const) {
    const it = await itemRepo.create({
      tripId: trip.id,
      date: trip.startDate,
      kind: 'place',
      title,
    });
    await itemRepo.setVisit(it.id, v);
  }
}

it('기록 탭 방문 기록은 합계와 최근 여행 줄만, [전체 보기]로', async () => {
  await seedVisits();
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/records'] })} />);
  const log = await screen.findByRole('region', { name: '방문 기록' });
  expect(await within(log).findByText('방문 3 · 미방문 1 · 도시 2곳')).toBeInTheDocument();
  const rows = within(log).getAllByRole('listitem');
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent('오사카 또');
  expect(within(log).getByRole('link', { name: /전체 보기/ })).toHaveAttribute(
    'href',
    '/records/visits',
  );
});

it('방문 기록 화면: 여행별 → 도시별 → 장소별, 검색', async () => {
  await seedVisits();
  render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/records/visits'] })} />,
  );
  // 여행별: 최근 여행만 펼쳐 있다
  const recent = await screen.findByRole('region', { name: '오사카 또' });
  expect(within(recent).getByText('오사카성')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '오사카' })).not.toHaveTextContent('도톤보리');

  fireEvent.click(screen.getByRole('radio', { name: '도시별' }));
  const osaka = await screen.findByRole('region', { name: '오사카' });
  expect(osaka).toHaveTextContent('방문 2 · 여행 2번');
  expect(within(osaka).getAllByRole('listitem')).toHaveLength(3);

  fireEvent.click(screen.getByRole('radio', { name: '장소별' }));
  expect(await screen.findByRole('region', { name: '오사카성' })).toHaveTextContent('방문 2번');

  fireEvent.change(screen.getByRole('searchbox', { name: '방문 기록 검색' }), {
    target: { value: 'ㅋㄴ' },
  });
  expect(await screen.findByRole('region', { name: '캐널시티' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '오사카성' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole('searchbox', { name: '방문 기록 검색' }), {
    target: { value: '없는 곳' },
  });
  expect(await screen.findByText('찾는 장소가 없어요')).toBeInTheDocument();
});

it('지운 여행 안의 방문 기록은 보이지 않는다', async () => {
  const trip = await tripRepo.create({
    timezone: 'Asia/Tokyo',
    cover: {},
    title: '지운 여행',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2025-05-01',
    endDate: '2025-05-01',
  });
  const it = await itemRepo.create({
    tripId: trip.id,
    date: '2025-05-01',
    kind: 'place',
    title: '센소지',
  });
  await itemRepo.setVisit(it.id, 'visited');
  expect(await itemRepo.listVisited()).toHaveLength(1);
  await tripRepo.softDelete(trip.id);
  expect(await itemRepo.listVisited()).toEqual([]);
});
