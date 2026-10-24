import type { ItineraryItem, Trip } from '@trippocket/shared';
import { resetUsageFlags } from '../../data/api/usage';
import { render, screen, waitFor } from '@testing-library/react';
import type * as Maps from '../../shared/maps';
import type { MapHandle, MapMarker } from '../../shared/maps';

// 실제 지도 SDK 대신 흉내 낸 지도
const calls: { markers: MapMarker[]; paths: number; click?: (id: string) => void } = {
  markers: [],
  paths: 0,
};
vi.mock('../../shared/maps', async (orig) => {
  const real = await orig<typeof Maps>();
  return {
    ...real,
    MAP_KEYS: { google: 'g-key', naver: undefined },
    chooseProvider: (p: 'auto' | 'google' | 'naver', d: boolean) =>
      real.chooseProvider(p, d, { google: 'g-key', naver: undefined }),
    mountMap: async (): Promise<MapHandle> => ({
      setMarkers: (m) => void (calls.markers = [...m]),
      drawPaths: (p) => void (calls.paths = p.filter((x) => x.points.length > 1).length),
      fitBounds: () => {},
      onMarkerClick: (cb) => void (calls.click = cb),
      destroy: () => {},
    }),
  };
});
const { TripMap } = await import('./TripMap');

const T = '2026-10-23T00:00:00.000Z';
const trip = {
  id: 't',
  title: '도쿄',
  destinations: [
    { name: '도쿄', kind: 'city', countryCode: 'JP', coords: { lat: 35.68, lng: 139.69 } },
  ],
  startDate: '2026-11-01',
  endDate: '2026-11-02',
  timezone: 'Asia/Tokyo',
  cover: {},
  createdAt: T,
  updatedAt: T,
} as Trip;
const item = (
  id: string,
  date: string | null,
  order: string,
  coords?: { lat: number; lng: number },
) =>
  ({
    id,
    tripId: 't',
    date,
    order,
    kind: 'place',
    title: id,
    place: coords ? { coords } : undefined,
    createdAt: T,
    updatedAt: T,
  }) as ItineraryItem;

describe('일정 지도', () => {
  it('키 선택: 자동이면 국내=네이버, 해외=구글, 키 없으면 다른 쪽, 둘 다 없으면 없음', async () => {
    const { chooseProvider } = await vi.importActual<typeof Maps>('../../shared/maps');
    expect(chooseProvider('auto', true, { google: 'g', naver: 'n' })).toBe('naver');
    expect(chooseProvider('auto', false, { google: 'g', naver: 'n' })).toBe('google');
    expect(chooseProvider('auto', true, { google: 'g', naver: undefined })).toBe('google');
    expect(chooseProvider('naver', false, { google: undefined, naver: undefined })).toBeNull();
  });

  it('좌표 있는 일정만 일차별 번호 핀 + 순서선, 핀을 누르면 그 일정', async () => {
    const onSelect = vi.fn();
    render(
      <TripMap
        trip={trip}
        items={[
          item('B', '2026-11-01', 'b', { lat: 35.7, lng: 139.7 }),
          item('A', '2026-11-01', 'a', { lat: 35.71, lng: 139.79 }),
          item('C', '2026-11-02', 'a', { lat: 35.66, lng: 139.7 }),
          item('주소 없음', '2026-11-02', 'b'),
          item('가고 싶은 곳', null, 'a', { lat: 1, lng: 1 }),
        ]}
        dayIndexOf={(d) => (d === '2026-11-01' ? 0 : 1)}
        onSelect={onSelect}
      />,
    );
    await waitFor(() => expect(calls.markers).toHaveLength(3));
    expect(calls.markers.map((m) => [m.id, m.label])).toEqual([
      ['A', '1'],
      ['B', '2'],
      ['C', '1'],
    ]);
    expect(calls.paths).toBe(1); // 1일차만 2곳 이상
    calls.click?.('B');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'B' }));
    expect(screen.queryByText(/키를 아직/)).not.toBeInTheDocument();
  });
});

describe('일정 지도 — 안내 문구', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('"장소를 검색해 고른 일정만" 안내는 이 기기에서 처음 한 번만', async () => {
    localStorage.removeItem('tp-map-hint-seen');
    resetUsageFlags();
    vi.stubGlobal('fetch', async () => Response.json({ maps: true }));
    const first = render(
      <TripMap trip={trip} items={[]} dayIndexOf={() => 0} onSelect={() => {}} />,
    );
    expect(await screen.findByText(/장소를 검색해 고른 일정만/)).toBeInTheDocument();
    first.unmount();
    render(<TripMap trip={trip} items={[]} dayIndexOf={() => 0} onSelect={() => {}} />);
    await waitFor(() => expect(calls.markers).toEqual([]));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/장소를 검색해 고른 일정만/)).not.toBeInTheDocument();
  });
});

describe('일정 지도 — 사용량 관리', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('관리자가 Google 지도를 멈추면 지도를 열지 않고 안내, 열리면 로드 1회 기록', async () => {
    resetUsageFlags();
    const posts: string[] = [];
    let maps = false;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') posts.push(url);
      return Response.json(url === '/api/usage/flags' ? { maps } : { ok: true });
    });
    const { unmount } = render(
      <TripMap trip={trip} items={[]} dayIndexOf={() => 0} onSelect={() => {}} />,
    );
    expect(await screen.findByText(/지도를 잠시 멈췄어요/)).toBeInTheDocument();
    expect(posts).toEqual([]);
    unmount();
    maps = true;
    resetUsageFlags(); // 허용 여부는 5분 동안 저장해 두므로 시험에서는 비운다
    render(<TripMap trip={trip} items={[]} dayIndexOf={() => 0} onSelect={() => {}} />);
    await waitFor(() => expect(posts).toEqual(['/api/usage/map-load']));
  });
});
