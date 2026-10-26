import type { ItineraryItem } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
import { DepartureLine } from './DepartureLine';

const item = (id: string, title: string, startTime: string, lat: number, google = false) =>
  ({
    id,
    tripId: 't',
    date: '2026-10-25',
    order: id,
    kind: 'place',
    title,
    startTime,
    place: { name: title, coords: { lat, lng: 139.7 }, coordsSource: google ? 'google' : 'osm' },
    createdAt: '',
    updatedAt: '',
  }) as ItineraryItem;

beforeEach(() => localStorage.removeItem('tp-route-eta'));
afterEach(() => vi.unstubAllGlobals());

describe('출발 시각 (실험실)', () => {
  it('서버가 준 도보·대중교통 시간과 출발 시각, Google 좌표면 google: true로 묻는다', async () => {
    const bodies: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return Response.json({ walk: 50, transit: 25, source: 'google' });
    });
    render(
      <ol>
        <DepartureLine
          from={item('a', '센소지', '10:00', 35.71)}
          to={item('b', '도쿄타워', '14:00', 35.66, true)}
        />
      </ol>,
    );
    expect(await screen.findByText(/대중교통 25분/)).toHaveTextContent('도보 50분 · 대중교통 25분');
    expect(screen.getByText('13:35에 출발')).toBeInTheDocument();
    expect(JSON.parse(bodies[0]!).google).toBe(true);
  });

  it('길 정보를 못 받으면 직선거리 어림', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    render(
      <ol>
        <DepartureLine
          from={item('a', '센소지', '10:00', 35.71)}
          to={item('b', '우에노', '11:00', 35.713)}
        />
      </ol>,
    );
    expect(await screen.findByText('길 정보를 못 받아 직선거리로 어림했어요')).toBeInTheDocument();
    expect(screen.getByText(/도보 \d+분/)).toBeInTheDocument();
  });
});
