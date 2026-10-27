import type { ItineraryItem, Trip } from '@trippocket/shared';
import { resetUsageFlags } from '../../data/api/usage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as Maps from '../../shared/maps';
import type { MapHandle, MapMarker } from '../../shared/maps';

// 실제 지도 SDK 대신 흉내 낸 지도
const calls: {
  markers: MapMarker[];
  paths: number;
  click?: (id: string) => void;
  panned?: { lat: number; lng: number };
} = {
  markers: [],
  paths: 0,
};
vi.mock('../../shared/maps', async (orig) => {
  const real = await orig<typeof Maps>();
  return {
    ...real,
    MAP_KEYS: { google: 'g-key', naver: undefined },
    chooseProvider: (d: boolean) => real.chooseProvider(d, { google: 'g-key', naver: undefined }),
    mountMap: async (): Promise<MapHandle> => ({
      setMarkers: (m) => void (calls.markers = [...m]),
      drawPaths: (p) => void (calls.paths = p.filter((x) => x.points.length > 1).length),
      fitBounds: () => {},
      panTo: (p) => void (calls.panned = p),
      resize: () => {},
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
  it('키 선택: 국내=네이버, 해외=구글, 키 없으면 다른 쪽, 둘 다 없으면 없음', async () => {
    const { chooseProvider } = await vi.importActual<typeof Maps>('../../shared/maps');
    expect(chooseProvider(true, { google: 'g', naver: 'n' })).toBe('naver');
    expect(chooseProvider(false, { google: 'g', naver: 'n' })).toBe('google');
    expect(chooseProvider(true, { google: 'g', naver: undefined })).toBe('google');
    expect(chooseProvider(false, { google: undefined, naver: undefined })).toBeNull();
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

describe('일정 지도 — 크게·전체 화면', () => {
  beforeEach(() => {
    resetUsageFlags();
    vi.stubGlobal('fetch', async () => Response.json({ maps: true }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('작은 지도를 누르면 크게, 크게 볼 때는 [작게]와 고른 일정 핀으로 이동', async () => {
    const onSizeChange = vi.fn();
    const { rerender } = render(
      <TripMap
        trip={trip}
        items={[]}
        dayIndexOf={() => 0}
        onSelect={() => {}}
        onSizeChange={onSizeChange}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: '지도 크게 보기' }));
    expect(onSizeChange).toHaveBeenLastCalledWith('large');
    const focus = item('A', '2026-11-01', 'a', { lat: 35.7, lng: 139.7 });
    rerender(
      <TripMap
        trip={trip}
        items={[focus]}
        dayIndexOf={() => 0}
        onSelect={() => {}}
        size="large"
        focus={focus}
        onSizeChange={onSizeChange}
      />,
    );
    await waitFor(() => expect(calls.panned).toEqual({ lat: 35.7, lng: 139.7 }));
    fireEvent.click(screen.getByRole('button', { name: '작게' }));
    expect(onSizeChange).toHaveBeenLastCalledWith('small');
  });

  it('꾹 누르면 전체 화면(그 뒤 click은 무시), 끌면 취소, 전체 화면은 X로 닫는다', async () => {
    const onSizeChange = vi.fn();
    const { rerender } = render(
      <TripMap
        trip={trip}
        items={[]}
        dayIndexOf={() => 0}
        onSelect={() => {}}
        onSizeChange={onSizeChange}
      />,
    );
    const area = await screen.findByRole('button', { name: '지도 크게 보기' });
    vi.useFakeTimers();
    // 끌면(10px 넘게 움직이면) 취소
    fireEvent.pointerDown(area, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(area, { clientX: 40, clientY: 10 });
    vi.advanceTimersByTime(600);
    expect(onSizeChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(area);
    // 꾹 누르기
    fireEvent.pointerDown(area, { clientX: 10, clientY: 10 });
    vi.advanceTimersByTime(600);
    vi.useRealTimers();
    expect(onSizeChange).toHaveBeenLastCalledWith('full');
    fireEvent.pointerUp(area);
    fireEvent.click(area);
    expect(onSizeChange).toHaveBeenCalledTimes(1);

    rerender(
      <TripMap
        trip={trip}
        items={[]}
        dayIndexOf={() => 0}
        onSelect={() => {}}
        size="full"
        onSizeChange={onSizeChange}
      />,
    );
    expect(screen.getByRole('dialog', { name: '전체 화면 지도' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 화면 지도 닫기' }));
    expect(onSizeChange).toHaveBeenLastCalledWith('large');
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

  it('Google 지도가 멈추면 무료 지도(OpenFreeMap)로 · Google에서 찾은 장소는 그 지도에 안 올린다, 무료 지도까지 멈추면 안내 (docs/23 §4)', async () => {
    resetUsageFlags();
    const posts: string[] = [];
    let apis: Record<string, boolean> = { google_maps_js: false, openfreemap: false };
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') posts.push(String(init.body));
      return Response.json(
        url === '/api/usage/flags' ? { maps: apis.google_maps_js, apis } : { ok: true },
      );
    });
    const r1 = render(<TripMap trip={trip} items={[]} dayIndexOf={() => 0} onSelect={() => {}} />);
    expect(await screen.findByText(/지도를 잠시 멈췄어요/)).toBeInTheDocument();
    expect(posts).toEqual([]);
    r1.unmount();

    apis = { google_maps_js: false, openfreemap: true };
    resetUsageFlags();
    const fromGoogle = { ...item('g', '2026-11-01', 'a0', { lat: 35.69, lng: 139.7 }) };
    fromGoogle.place = { ...fromGoogle.place!, coordsSource: 'google' };
    const r2 = render(
      <TripMap
        trip={trip}
        items={[fromGoogle, item('u', '2026-11-01', 'a1', { lat: 35.7, lng: 139.71 })]}
        dayIndexOf={() => 0}
        onSelect={() => {}}
      />,
    );
    expect(
      await screen.findByText(/Google에서 찾은 장소는 이 지도에 안 보여요/),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls.markers.map((m) => m.id)).toEqual(['u']));
    expect(posts).toEqual([JSON.stringify({ api: 'openfreemap' })]);
    r2.unmount();
    posts.length = 0;
    const maps = true;
    apis = { google_maps_js: maps, openfreemap: true };
    resetUsageFlags(); // 허용 여부는 5분 동안 저장해 두므로 시험에서는 비운다
    render(<TripMap trip={trip} items={[]} dayIndexOf={() => 0} onSelect={() => {}} />);
    await waitFor(() => expect(posts).toEqual([JSON.stringify({ api: 'google_maps_js' })]));
  });
});
