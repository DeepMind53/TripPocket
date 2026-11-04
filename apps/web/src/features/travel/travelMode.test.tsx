import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { setLab } from '../../data/labsStore';
import { resetLocalDb } from '../../data/dev';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { useTravelMode } from '../../data/travelModeStore';
import { useToastStore } from '../../shared/ui/toastStore';

vi.mock('../itinerary/TripMap', () => ({ TripMap: () => null }));

beforeEach(async () => {
  await resetLocalDb();
  localStorage.removeItem('tp-travel-mode');
  useTravelMode.setState({ on: {}, asked: {}, sun: false, remind: false });
  setLab('travelMode', true, { silent: true });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.stubGlobal('fetch', async () => Response.json({}));
});
afterEach(() => {
  setLab('travelMode', false, { silent: true });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function osaka() {
  const trip = await tripRepo.create({
    title: '오사카',
    destinations: [{ name: '오사카', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-11-03',
    endDate: '2026-11-04',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  await itemRepo.create({
    tripId: trip.id,
    date: '2026-11-03',
    kind: 'place',
    title: '도톤보리',
    startTime: '09:00',
    endTime: '10:30',
  });
  await itemRepo.create({
    tripId: trip.id,
    date: '2026-11-03',
    kind: 'place',
    title: '오사카성',
    startTime: '11:00',
    place: { name: '오사카성' },
  });
  await itemRepo.create({
    tripId: trip.id,
    date: '2026-11-04',
    kind: 'place',
    title: '유니버설 스튜디오',
    startTime: '09:00',
  });
  return trip;
}

const open = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

it('여행 모드: 여행 중이면 한 번 묻고, 시작하면 지금·다음 일정과 남은 시간', async () => {
  vi.setSystemTime(new Date('2026-11-03T01:35:00Z')); // 오사카 10:35
  const trip = await osaka();
  const user = userEvent.setup();
  open(`/trips/${trip.id}/plan`);
  const ask = await screen.findByRole('region', { name: '여행 모드로 볼까요?' });
  await user.click(within(ask).getByRole('button', { name: '시작' }));

  // 다음 일정: 나갈 시각이 크게 (시작 11:00 − 여유 10분), 남은 분은 작게
  const nextBox = await screen.findByRole('region', { name: '다음' });
  expect(screen.getByText(/^1일차 · 11.03 \(화\)$/)).toBeInTheDocument();
  expect(within(nextBox).getByText('10:50에 나가요')).toBeInTheDocument();
  expect(within(nextBox).getByText('15분 남음')).toBeInTheDocument();
  expect(within(nextBox).getByRole('button', { name: '길찾기' })).toBeInTheDocument();
  // 오늘/내일 탭은 없다 (Q1)
  expect(screen.queryByRole('tab')).toBeNull();

  // 지난 일정은 접혀 있고, 펼쳐서 다녀옴·건너뛰기
  expect(screen.queryByText('도톤보리')).toBeNull();
  await user.click(screen.getByRole('button', { name: '지난 일정 1' }));
  const past = screen.getByRole('list', { name: '지난 일정' });
  await user.click(within(past).getByRole('button', { name: '다녀옴' }));
  await waitFor(() => expect(within(past).queryByRole('button', { name: '다녀옴' })).toBeNull());

  // 긴급 연락처는 늘 오른쪽 위
  expect(screen.getByRole('button', { name: '긴급 연락처' })).toBeInTheDocument();

  // 숙소가 없으면 알려 준다 (숙소로 길찾기는 늘 맨 앞)
  await user.click(screen.getByRole('button', { name: '숙소로 길찾기' }));
  expect(useToastStore.getState().items.map((x) => x.message)).toContain('숙소 예약이 없어요');

  // 홈 모양 [여행 모드 끄기]면 일반 일정 화면, 다시 묻지 않음
  await user.click(screen.getByRole('button', { name: '여행 모드 끄기' }));
  await screen.findByRole('toolbar');
  expect(screen.queryByRole('region', { name: '여행 모드로 볼까요?' })).toBeNull();
  expect(useTravelMode.getState().on[trip.id]).toBe(false);
});

it('여행 모드: 아침에는 브리핑, 저녁에는 정리와 내일 미리보기 (시간대별 엄지 버튼)', async () => {
  vi.setSystemTime(new Date('2026-11-02T23:00:00Z')); // 오사카 08:00
  const trip = await osaka();
  useTravelMode.setState({ on: { [trip.id]: true }, asked: { [trip.id]: true } });
  const view = open(`/trips/${trip.id}/go`);
  const morning = await screen.findByRole('region', { name: '오늘 아침' });
  expect(within(morning).getByText('오늘 2곳 · 첫 일정 09:00')).toBeInTheDocument();
  const thumbs = screen.getByRole('navigation', { name: '자주 쓰는 버튼' });
  expect(within(thumbs).getByRole('button', { name: '준비물' })).toBeInTheDocument();
  view.unmount();

  vi.setSystemTime(new Date('2026-11-03T05:00:00Z')); // 오사카 14:00
  open(`/trips/${trip.id}/go`);
  const evening = await screen.findByRole('region', { name: '오늘 정리' });
  expect(within(evening).getByText('오늘 2곳 중 0곳 다녀옴')).toBeInTheDocument();
  expect(within(evening).getByText('09:00 유니버설 스튜디오')).toBeInTheDocument();
  expect(
    within(screen.getByRole('navigation', { name: '자주 쓰는 버튼' })).getByRole('button', {
      name: '필수 항목',
    }),
  ).toBeInTheDocument();
});

it('여행 모드: [괜찮아요]면 그 여행에서는 다시 묻지 않는다', async () => {
  vi.setSystemTime(new Date('2026-11-03T01:35:00Z'));
  const trip = await osaka();
  const user = userEvent.setup();
  open(`/trips/${trip.id}/plan`);
  const ask = await screen.findByRole('region', { name: '여행 모드로 볼까요?' });
  await user.click(within(ask).getByRole('button', { name: '괜찮아요' }));
  expect(screen.queryByRole('region', { name: '여행 모드로 볼까요?' })).toBeNull();
  expect(useTravelMode.getState().asked[trip.id]).toBe(true);
});

it('여행 모드: 돌아온 다음 날에는 저절로 꺼진다', async () => {
  vi.setSystemTime(new Date('2026-11-05T01:00:00Z'));
  const trip = await osaka();
  useTravelMode.setState({ on: { [trip.id]: true }, asked: { [trip.id]: true } });
  open(`/trips/${trip.id}/plan`);
  await screen.findByRole('toolbar');
  await waitFor(() => expect(useTravelMode.getState().on[trip.id]).toBe(false));
});

it('빠른 메뉴: 여행 밖에서는 탭마다 맞는 정보와 바로가기', async () => {
  vi.setSystemTime(new Date('2026-11-01T01:00:00Z'));
  const trip = await osaka();
  const user = userEvent.setup();
  open('/');
  await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
  const home = await screen.findByRole('region', { name: '다가오는 여행' });
  expect(await within(home).findByText('오사카')).toBeInTheDocument();
  expect(within(home).getByText('출발까지 D-2')).toBeInTheDocument();
  await user.click(within(home).getByRole('button', { name: '예약' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: '다가오는 여행' })).toBeNull());
  expect(trip.id).toBeTruthy();
});

it('여행 모드 켜기 버튼: 홈 왼쪽 위와 빠른 메뉴 제목 오른쪽 (실험실을 켰을 때만)', async () => {
  vi.setSystemTime(new Date('2026-11-03T01:35:00Z'));
  const trip = await osaka();
  const user = userEvent.setup();
  const view = open('/');
  const btn = await screen.findByRole('button', { name: '여행 모드' });
  await user.click(btn);
  expect(await screen.findByRole('region', { name: '다음' })).toBeInTheDocument();
  expect(useTravelMode.getState().on[trip.id]).toBe(true);
  view.unmount();

  useTravelMode.setState({ on: {}, asked: { [trip.id]: true } });
  open(`/trips/${trip.id}/bookings`);
  await user.click(await screen.findByRole('button', { name: '빠른 메뉴' }));
  const sheet = await screen.findByRole('dialog', { name: '빠른 메뉴' });
  await user.click(within(sheet).getByRole('button', { name: '여행 모드' }));
  expect(await screen.findByRole('region', { name: '다음' })).toBeInTheDocument();
});
