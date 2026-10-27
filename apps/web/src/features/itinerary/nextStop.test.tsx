import type { ItineraryItem } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
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

it('위치를 허락하면 다음 일정까지 도보·대중교통 시간과 여유 둔 출발 시각 (위치는 100m로 줄여 live로)', async () => {
  const bodies: string[] = [];
  vi.stubGlobal('fetch', async (_u: string, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return Response.json({ walk: 40, transit: 20, source: 'osm' });
  });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: () => Promise.resolve({ state: 'prompt' }) },
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
        ok({ coords: { latitude: 35.712345, longitude: 139.796789 } }),
    },
  });
  const user = userEvent.setup();
  render(<NextStopBar next={next} now="13:00" />);
  await user.click(screen.getByRole('button', { name: '현재 위치 제공 후 관련 정보 수신' }));
  // 3줄: 다음 일정 / 도보·대중교통 시간 / 여유 10분 두고 출발 시각 (대중교통 20분 + 10분 → 13:00 = 지금)
  expect(await screen.findByText('도보 40분 · 대중교통 20분')).toBeInTheDocument();
  expect(screen.getByText('지금 바로 출발하세요')).toBeInTheDocument();
  expect(JSON.parse(bodies[0]!)).toMatchObject({
    from: { lat: 35.712, lng: 139.797 },
    live: true,
  });
});

it('길 정보를 못 받으면 직선거리 어림으로 대신하고 한도 팝업은 없다', async () => {
  vi.stubGlobal('fetch', async () =>
    Response.json({ error: 'no_route', api: 'geoapify' }, { status: 503 }),
  );
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: () => Promise.resolve({ state: 'granted' }) },
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
        ok({ coords: { latitude: 35.6905, longitude: 139.7005 } }),
    },
  });
  render(<NextStopBar next={next} now="12:00" />);
  expect(await screen.findByText(/^도보 \d+분 \(어림\)$/)).toBeInTheDocument();
  expect(screen.getByText(/^\d{2}:\d{2} 전 출발 \(여유 10분\)$/)).toBeInTheDocument();
  expect(useLimitNotice.getState().notice).toBeNull();
});

it('대중교통이 없으면(일본) 지도 앱 링크, 도보가 없으면(한국) 직선거리 어림', async () => {
  let reply: object = { walk: 150, source: 'google' };
  vi.stubGlobal('fetch', async () => Response.json(reply));
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: () => Promise.resolve({ state: 'granted' }) },
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
        ok({ coords: { latitude: 35.6905, longitude: 139.7005 } }),
    },
  });
  const { unmount } = render(<NextStopBar next={next} now="10:00" />);
  expect(await screen.findByText('도보 150분')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: '대중교통은 지도 앱에서 보기' });
  expect(link.getAttribute('href')).toContain('travelmode=transit');
  expect(link.getAttribute('href')).not.toContain('origin');
  unmount();

  reply = { transit: 28, source: 'google' };
  render(
    <NextStopBar
      next={{ ...next, id: 'k', place: { ...next.place!, coords: { lat: 35.7, lng: 139.71 } } }}
      now="10:00"
    />,
  );
  expect(await screen.findByText(/^도보 \d+분 \(어림\) · 대중교통 28분$/)).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: '대중교통은 지도 앱에서 보기' }),
  ).not.toBeInTheDocument();
});
