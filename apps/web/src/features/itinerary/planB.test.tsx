import { uuidv7 } from '@trippocket/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useDayPlanStore } from '../../data/dayPlanStore';
import { resetLocalDb } from '../../data/dev';
import { setLab } from '../../data/labsStore';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import ConditionCheck from './ConditionCheck';

beforeEach(async () => {
  await resetLocalDb();
  localStorage.removeItem('tp-dayplan');
  useDayPlanStore.setState({ moods: {}, picks: {} });
  setLab('planB', true, { silent: true });
});
afterEach(() => {
  setLab('planB', false, { silent: true });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function rainyTrip() {
  const rainy = uuidv7();
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [
      { name: '도쿄', kind: 'city', countryCode: 'JP', coords: { lat: 35.68, lng: 139.76 } },
    ],
    startDate: '2026-10-23',
    endDate: '2026-10-24',
    timezone: 'Asia/Tokyo',
    cover: {},
    dayPlans: [
      {
        id: rainy,
        date: '2026-10-23',
        name: 'Plan B 실내',
        match: 'any',
        conditions: [{ type: 'weather', weather: ['rain'] }],
      },
    ],
  });
  await itemRepo.create({ tripId: trip.id, date: '2026-10-23', kind: 'place', title: '공원 산책' });
  await itemRepo.create({
    tripId: trip.id,
    date: '2026-10-23',
    kind: 'place',
    title: '박물관',
    planId: rainy,
  });
  return trip;
}

it('Plan B: 비 예보면 그날은 Plan B 일정이 먼저 보이고, 날짜를 눌러 기본 일정으로 바꿀 수 있다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
  vi.stubGlobal('fetch', async () =>
    Response.json({
      daily: {
        time: ['2026-10-23', '2026-10-24'],
        weather_code: [61, 0],
        temperature_2m_max: [14, 20],
        temperature_2m_min: [8, 12],
      },
    }),
  );
  const trip = await rainyTrip();
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan`] })}
    />,
  );
  const day1 = () => screen.getByRole('region', { name: /^1일차/ });
  await waitFor(() => expect(within(day1()).getByText('박물관')).toBeInTheDocument());
  expect(within(day1()).queryByText('공원 산책')).toBeNull();
  expect(within(day1()).getByText('Plan B 실내 · 자동')).toBeInTheDocument();

  await user.click(within(day1()).getByRole('button', { name: /1일차.*플랜 고르기/ }));
  const sheet = await screen.findByRole('dialog', { name: /플랜$/ });
  expect(within(sheet).getByText(/지금은 Plan B 실내 조건이 맞아요/)).toBeInTheDocument();
  await user.click(within(sheet).getByRole('button', { name: /^기본 일정/ }));
  // 시트를 닫으면 그날은 기본 일정
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(within(day1()).getByText('공원 산책')).toBeInTheDocument());
  expect(within(day1()).queryByText('박물관')).toBeNull();
});

it('Plan B를 끄면 대안 플랜 일정은 숨기고 기본 일정만', async () => {
  setLab('planB', false, { silent: true });
  const trip = await rainyTrip();
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/trips/${trip.id}/plan`] })}
    />,
  );
  expect(await screen.findByText('공원 산책')).toBeInTheDocument();
  expect(screen.queryByText('박물관')).toBeNull();
  expect(screen.queryByRole('button', { name: /플랜 고르기/ })).toBeNull();
});

it('아침 컨디션 체크: 여행 중 현지 5시 이후 처음 열면 묻고, 고르면 그날 컨디션으로 저장', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-23T00:30:00Z')); // 도쿄 09:30
  const trip = await rainyTrip();
  const user = userEvent.setup();
  render(<ConditionCheck />);
  const sheet = await screen.findByRole('dialog', { name: '오늘 컨디션은 어때요?' });
  await user.click(within(sheet).getByRole('button', { name: /피곤해요/ }));
  expect(useDayPlanStore.getState().moods[`${trip.id}:2026-10-23`]).toBe(4);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
