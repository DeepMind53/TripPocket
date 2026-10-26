import type { ItineraryItem } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextStopBar } from './NextStopBar';

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

it('위치를 허락하면 지금 위치에서 다음 일정까지 도보·대중교통 출발 시각, 늦으면 알림 (위치는 100m로 줄여 live로)', async () => {
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
  expect(await screen.findByText('걸어서 약 40분인데 30분 뒤 일정이에요')).toBeInTheDocument();
  expect(screen.getByText('대중교통 20분 · 13:10 출발')).toBeInTheDocument();
  expect(JSON.parse(bodies[0]!)).toMatchObject({
    from: { lat: 35.712, lng: 139.797 },
    live: true,
  });
});
