import type { Trip } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addSpot, syncSpotsTrip, useSavedSpots } from '../../data/savedSpots';
import { SavedSpotsButtons } from './SavedSpotsButtons';

/** 빠른 메뉴 현재 위치 저장 (사용자 요청 2026-11-02): 이 기기·이번 여행만, GPS가 안 되면 안내 */
const trip = (id: string, startDate: string) =>
  ({
    id,
    title: id,
    startDate,
    endDate: startDate,
    timezone: 'Asia/Seoul',
    destinations: [],
  }) as unknown as Trip;

afterEach(() => {
  useSavedSpots.setState({ tripId: null, spots: [] });
  localStorage.removeItem('tp-saved-spots');
  vi.unstubAllGlobals();
});

it('다음 여행이 시작되면 예전 여행 위치를 지우고, 시작 전에 열어 보기만 하면 남긴다', () => {
  addSpot('a', { name: '주차장', lat: 35, lng: 139 });
  syncSpotsTrip(trip('b', '2026-12-01'), '2026-11-02');
  expect(useSavedSpots.getState().spots).toHaveLength(1);
  syncSpotsTrip(trip('b', '2026-12-01'), '2026-12-01');
  expect(useSavedSpots.getState()).toEqual({ tripId: 'b', spots: [] });
});

it('이름을 적고 저장하면 지금 위치로, GPS가 안 되면 저장하지 않고 안내', async () => {
  let ok = true;
  vi.stubGlobal('navigator', {
    ...navigator,
    geolocation: {
      getCurrentPosition: (yes: PositionCallback, no: PositionErrorCallback) =>
        ok
          ? yes({ coords: { latitude: 35.1, longitude: 139.2 } } as GeolocationPosition)
          : no({ code: 2 } as GeolocationPositionError),
    },
  });
  const user = userEvent.setup();
  render(<SavedSpotsButtons trip={trip('t', '2026-01-01')} />);
  await user.click(screen.getByRole('button', { name: '현재 위치 저장' }));
  expect(screen.getByText(/이번 여행에만 쓰는 목록이에요/)).toBeInTheDocument();
  await user.type(screen.getByPlaceholderText(/주차한 곳/), '주차장');
  await user.click(screen.getByRole('button', { name: '지금 위치로 저장' }));
  expect(useSavedSpots.getState().spots[0]).toMatchObject({ name: '주차장', lat: 35.1 });

  ok = false;
  await user.click(screen.getByRole('button', { name: '현재 위치 저장' }));
  await user.type(screen.getByPlaceholderText(/주차한 곳/), '호텔 앞');
  await user.click(screen.getByRole('button', { name: '지금 위치로 저장' }));
  expect(await screen.findByText('위치를 찾지 못했어요')).toBeInTheDocument();
  expect(useSavedSpots.getState().spots).toHaveLength(1);
});
