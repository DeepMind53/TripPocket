import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb, seedSampleTrip } from '../../data/dev';
import { checklistRepo } from '../../data/repositories/checklistRepo';

beforeEach(async () => {
  await resetLocalDb();
});

it('여행 전 홈: 준비 현황 4장(준비물·예약·날씨 정보·환율) + AI 추천, 숙소 없으면 확인 표시', async () => {
  const tripId = await seedSampleTrip(); // 3일 뒤 출발
  await checklistRepo.add(tripId, 'packing', { text: '여권' });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
  const prep = await screen.findByRole('region', { name: '준비 현황' });
  // 기본은 한 줄 요약 (docs/20 U3) — 누르면 펼침
  const summary = within(prep).getByRole('button', { expanded: false });
  await waitFor(() => expect(summary).toHaveTextContent('0/1'));
  fireEvent.click(summary);
  for (const name of ['준비물', '예약', '날씨 정보', '환율'])
    expect(within(prep).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
  expect(within(prep).getByRole('link', { name: /예약/ })).toHaveAttribute(
    'href',
    `/trips/${tripId}/bookings`,
  );
  expect(within(prep).getByRole('link', { name: /날씨 정보/ })).toHaveAttribute(
    'href',
    `/trips/${tripId}/weather`,
  );
  expect(within(prep).getByText('숙소 예약이 없어요')).toBeInTheDocument();
  expect(within(prep).getAllByRole('img', { name: '확인이 필요해요' }).length).toBeGreaterThan(0);
  expect(within(prep).getByRole('link', { name: /AI 추천 받기/ })).toHaveAttribute(
    'href',
    `/ai?trip=${tripId}`,
  );
});

it('여행 중 홈: 다음 일정 카드도 여행 모드처럼 [도보|대중교통|자동차]·[새로고침 n회 남음]·출발까지, [길찾기]·[일정 보기]는 그대로', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T01:35:00Z')); // 오사카 10:35
  vi.stubGlobal('fetch', async () => Response.json({}));
  const { tripRepo } = await import('../../data/repositories/tripRepo');
  const { itemRepo } = await import('../../data/repositories/itemRepo');
  const trip = await tripRepo.create({
    title: '오사카',
    destinations: [{ name: '오사카', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-11-03',
    endDate: '2026-11-04',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  for (const [title, startTime, lat] of [
    ['도톤보리', '09:00', 34.6687],
    ['오사카성', '11:00', 34.67],
  ] as const)
    await itemRepo.create({
      tripId: trip.id,
      date: '2026-11-03',
      kind: 'place',
      title,
      startTime,
      place: { name: title, coords: { lat, lng: 135.502 } },
    });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
  const legs = await screen.findByRole('radiogroup', { name: '이동 수단' });
  for (const name of ['도보', '대중교통', '자동차'])
    expect(within(legs).getByRole('radio', { name })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /새로고침/ })).toBeInTheDocument();
  expect(screen.getByText('후 출발')).toBeInTheDocument();
  expect(await screen.findByText(/^\(도보 직선거리 약 \d+분\)$/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '길찾기' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '일정 보기' })).toBeInTheDocument();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
