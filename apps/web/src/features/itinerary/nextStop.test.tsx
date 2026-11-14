import type { ItineraryItem } from '@trippocket/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextStopBar } from './NextStopBar';
import { useLimitNotice } from '../../data/limitNotice';

const next = {
  id: 'n',
  tripId: 't',
  date: '2026-10-25',
  order: 'a',
  kind: 'food',
  title: '이치란 라멘',
  startTime: '13:30',
  place: { name: '이치란', coords: { lat: 35.69, lng: 139.7 }, coordsSource: 'osm' },
  createdAt: '',
  updatedAt: '',
} as ItineraryItem;

afterEach(() => vi.unstubAllGlobals());

function at(lat: number, lng: number, onAsk?: () => void) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: () => Promise.resolve({ state: 'granted' }) },
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (
        ok: (p: { coords: { latitude: number; longitude: number } }) => void,
      ) => {
        onAsk?.();
        ok({ coords: { latitude: lat, longitude: lng } });
      },
    },
  });
}

/** [다음 목적지 이동시간] → 이동 수단 창에서 하나 고르기 */
async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: '다음 목적지 이동시간' }));
  const sheet = await screen.findByRole('dialog', { name: '이동 수단' });
  await user.click(within(sheet).getByRole('radio', { name }));
}

it('누르면 도보·대중교통·자동차 창, 고른 수단 시간과 "N분 후 출발" (위치는 100m로 줄여 live로)', async () => {
  const bodies: string[] = [];
  vi.stubGlobal('fetch', async (_u: string, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return Response.json({ walk: 40, transit: 20, source: 'osm' });
  });
  at(35.712345, 139.796789);
  const user = userEvent.setup();
  render(<NextStopBar next={next} now="12:00" />);
  await pick(user, '대중교통');
  // 13:30 − 대중교통 20분 − 여유 10분 = 13:00 → 1시간 후
  expect(await screen.findByText('대중교통 약 20분')).toBeInTheDocument();
  expect(screen.getByText('1시간 0분 후 출발')).toBeInTheDocument();
  expect(JSON.parse(bodies[0]!)).toMatchObject({ from: { lat: 35.712, lng: 139.797 }, live: true });

  // 도보로 바꾸면 이미 받은 결과를 다시 쓴다 (다시 묻지 않음)
  await user.click(screen.getByRole('button', { name: /^이동 수단 · / }));
  await user.click(
    within(await screen.findByRole('dialog', { name: '이동 수단' })).getByRole('radio', {
      name: '도보',
    }),
  );
  expect(await screen.findByText('도보 약 40분')).toBeInTheDocument();
  expect(screen.getByText('40분 후 출발')).toBeInTheDocument();
  expect(bodies).toHaveLength(1);
});

it('자동차를 고르면 자동차 길을 1번 조회해서 시간·거리', async () => {
  const bodies: string[] = [];
  vi.stubGlobal('fetch', async (_u: string, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return Response.json({ drive: 15, driveKm: 4.2, source: 'google' });
  });
  at(35.6905, 139.7005);
  const user = userEvent.setup();
  render(<NextStopBar next={next} now="13:00" />);
  await pick(user, '자동차');
  expect(await screen.findByText('자동차 약 15분 · 4.2km')).toBeInTheDocument();
  // 13:30 − 15분 − 10분 = 13:05 → 5분 후
  expect(screen.getByText('5분 후 출발')).toBeInTheDocument();
  expect(JSON.parse(bodies[0]!)).toMatchObject({ drive: true });
});

it('길 정보를 못 받으면 도보는 직선거리 어림으로 대신하고 한도 팝업은 없다', async () => {
  vi.stubGlobal('fetch', async () =>
    Response.json({ error: 'no_route', api: 'geoapify' }, { status: 503 }),
  );
  at(35.6905, 139.7005);
  const user = userEvent.setup();
  render(<NextStopBar next={next} now="12:00" />);
  await pick(user, '도보');
  expect(await screen.findByText(/^도보 직선거리 약 \d+분$/)).toBeInTheDocument();
  expect(screen.getByText(/후 출발$/)).toBeInTheDocument();
  expect(useLimitNotice.getState().notice).toBeNull();
});

it('대중교통이 없으면 "대중교통 검색 불가"와 지도 앱 링크 (출발지는 넣지 않음)', async () => {
  vi.stubGlobal('fetch', async () => Response.json({ walk: 150, source: 'google' }));
  at(35.6905, 139.7005);
  const user = userEvent.setup();
  render(<NextStopBar next={next} now="10:00" />);
  await pick(user, '대중교통');
  expect(await screen.findByText('대중교통 검색 불가')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: '지도' });
  expect(link.getAttribute('href')).toContain('travelmode=transit');
  expect(link.getAttribute('href')).not.toContain('origin');
  expect(screen.queryByText(/후 출발$/)).toBeNull();
});

it('도보가 200분 이상이면 "도보 검색 불가"', async () => {
  vi.stubGlobal('fetch', async () => Response.json({ walk: 240, transit: 40, source: 'google' }));
  at(35.6905, 139.7005);
  const user = userEvent.setup();
  render(<NextStopBar next={next} now="11:00" />);
  await pick(user, '도보');
  expect(await screen.findByText('도보 검색 불가')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '지도' }).getAttribute('href')).toContain(
    'travelmode=walking',
  );
});

it('비행기로 갈 만큼 먼 곳(다른 나라)이면 시간을 묻지도 보이지도 않는다', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (u: string) => {
    calls.push(u);
    return Response.json({ walk: 19909, source: 'google' });
  });
  at(37.56, 126.97); // 서울에서 도쿄 일정 보기
  const user = userEvent.setup();
  render(<NextStopBar next={next} now="10:00" />);
  await pick(user, '도보');
  expect(await screen.findByText('멀리 있어요 · 이동 시간은 계산하지 않아요')).toBeInTheDocument();
  expect(screen.queryByText(/도보/)).toBeNull();
  expect(calls).toEqual([]);
});

it('누르기 전에는 위치도 길도 묻지 않고, 다시 검색할 때마다 한 번씩만 (API 아끼기)', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (u: string) => {
    calls.push(u);
    return Response.json({ walk: 20, transit: 10, source: 'google' });
  });
  let asked = 0;
  at(35.6905, 139.7005, () => asked++);
  const user = userEvent.setup();
  render(<NextStopBar next={next} now="10:00" />);
  await new Promise((r) => setTimeout(r, 50));
  expect(asked).toBe(0);
  expect(calls).toEqual([]);
  // 창만 열고 닫으면 아무것도 묻지 않는다
  await user.click(screen.getByRole('button', { name: '다음 목적지 이동시간' }));
  await screen.findByRole('dialog', { name: '이동 수단' });
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(asked).toBe(0);

  await pick(user, '대중교통');
  expect(await screen.findByText('대중교통 약 10분')).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 50));
  expect(calls).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: '다음 목적지 이동시간 다시 검색' }));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(asked).toBe(2);
});
