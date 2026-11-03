import { uuidv7 } from '@trippocket/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useDayPlanStore } from '../../data/dayPlanStore';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { updateSettings } from '../../data/settingsStore';
import ConditionCheck from './ConditionCheck';

// 지도는 jsdom에서 못 그리니, 받은 핀(일정 이름)만 글로 보여 주는 가짜로 바꾼다
vi.mock('./TripMap', () => ({
  TripMap: ({ items }: { items: { title: string; date: string | null }[] }) => (
    <ul aria-label="지도 핀">
      {items
        .filter((i) => i.date)
        .map((i) => (
          <li key={i.title}>{i.title}</li>
        ))}
    </ul>
  ),
}));

beforeEach(async () => {
  await resetLocalDb();
  localStorage.removeItem('tp-dayplan');
  useDayPlanStore.setState({ moods: {}, picks: {} });
  updateSettings({ planB: true });
});
afterEach(() => {
  updateSettings({ planMapOpen: false });
  updateSettings({ planB: false });
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
  updateSettings({ planMapOpen: true });
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

  // 지도에도 지금 플랜 일정만 (사용자 요청 2026-11-03)
  const pins = () => screen.getByRole('list', { name: '지도 핀' });
  expect(within(pins()).getByText('박물관')).toBeInTheDocument();
  expect(within(pins()).queryByText('공원 산책')).toBeNull();

  await user.click(within(day1()).getByRole('button', { name: /1일차.*플랜 고르기/ }));
  const sheet = await screen.findByRole('dialog', { name: /플랜$/ });
  expect(within(sheet).getByText(/지금은 Plan B 실내 조건이 맞아요/)).toBeInTheDocument();
  await user.click(within(sheet).getByRole('button', { name: /^기본 일정/ }));
  // 시트를 닫으면 그날은 기본 일정
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(within(day1()).getByText('공원 산책')).toBeInTheDocument());
  expect(within(day1()).queryByText('박물관')).toBeNull();
  // 기본 일정으로 바꾸면 지도 핀도 기본 일정으로
  expect(within(pins()).getByText('공원 산책')).toBeInTheDocument();
  expect(within(pins()).queryByText('박물관')).toBeNull();
});

it('Plan B를 끄면 대안 플랜 일정은 숨기고 기본 일정만', async () => {
  updateSettings({ planB: false });
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

it('홈 "오늘 일정"도 지금 보이는 플랜 기준', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-23T00:30:00Z')); // 도쿄 09:30, 여행 1일차
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
  await rainyTrip();
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
  expect((await screen.findAllByText('박물관')).length).toBeGreaterThan(0);
  expect(screen.queryByText('공원 산책')).toBeNull();
});

it('플랜을 다른 날로 복사하고, 내일로 옮길 수 있다 (일정도 함께)', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T03:00:00Z'));
  vi.stubGlobal('fetch', async () =>
    Response.json({
      daily: {
        time: ['2026-10-23', '2026-10-24'],
        weather_code: [61, 61],
        temperature_2m_max: [14, 14],
        temperature_2m_min: [8, 8],
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
  await user.click(await screen.findByRole('button', { name: /1일차.*플랜 고르기/ }));
  const sheet = await screen.findByRole('dialog', { name: /플랜$/ });
  // 복사: 2일차에 같은 조건·일정의 새 플랜
  await user.click(within(sheet).getByRole('button', { name: 'Plan B 실내 다른 날로 복사' }));
  await user.click(within(sheet).getByRole('button', { name: /^2일차/ }));
  await waitFor(async () => {
    const t = await tripRepo.get(trip.id);
    expect(t?.dayPlans?.map((p) => p.date)).toEqual(['2026-10-23', '2026-10-24']);
  });
  const items = await itemRepo.listByTrip(trip.id);
  expect(
    items
      .filter((i) => i.title === '박물관')
      .map((i) => i.date)
      .sort(),
  ).toEqual(['2026-10-23', '2026-10-24']);
  // 내일로 옮기기: 1일차 플랜과 일정이 2일차로
  await user.click(within(sheet).getByRole('button', { name: 'Plan B 실내 내일로 옮기기' }));
  await waitFor(async () => {
    const t = await tripRepo.get(trip.id);
    expect(t?.dayPlans?.every((p) => p.date === '2026-10-24')).toBe(true);
  });
  expect(
    (await itemRepo.listByTrip(trip.id))
      .filter((i) => i.title === '박물관')
      .every((i) => i.date === '2026-10-24'),
  ).toBe(true);
});
