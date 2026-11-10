import type { Booking, Trip } from '@trippocket/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetLocalDb } from '../../data/dev';
import { updateSettings } from '../../data/settingsStore';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { FlightDelay } from '../bookings/FlightDelay';
import { SafetyNotices } from '../weather/SafetyNotices';
import { FestivalsSection } from './FestivalsSection';

/** 무료 API 2·3단계 화면 (실험실, docs/26 — 2026-11-03) */
beforeEach(async () => {
  await resetLocalDb();
});
afterEach(() => {
  updateSettings({ safetyNotice: false, festivals: false, flightDelay: false });
  vi.unstubAllGlobals();
});

it('외교부 안전공지: 켜면 여행 나라(한국 빼고) 공지를 보여 준다', async () => {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (u: string) => {
    urls.push(String(u));
    return Response.json({ notices: [{ title: '안전 유의 공지', date: '2026-11-01' }] });
  });
  const { rerender } = render(<SafetyNotices countries={['JP', 'KR']} />);
  expect(screen.queryByText('안전 유의 공지')).toBeNull();
  updateSettings({ safetyNotice: true });
  rerender(<SafetyNotices countries={['JP', 'KR']} />);
  expect(await screen.findByText('안전 유의 공지')).toBeInTheDocument();
  expect(urls).toEqual(['/api/info/safety/JP']);
});

it('축제·행사: 국내 여행이면 근처 행사, [+]로 가고 싶은 곳에', async () => {
  updateSettings({ festivals: true });
  vi.stubGlobal('fetch', async () =>
    Response.json({
      festivals: [
        {
          id: '1',
          title: '서울빛초롱축제',
          address: '서울 중구',
          start: '2026-11-01',
          end: '2026-11-30',
          coords: { lat: 37.56, lng: 126.97 },
        },
      ],
    }),
  );
  const trip = (await tripRepo.create({
    title: '서울',
    destinations: [
      { name: '서울', kind: 'city', countryCode: 'KR', coords: { lat: 37.56, lng: 126.97 } },
    ],
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    timezone: 'Asia/Seoul',
    cover: {},
  })) as Trip;
  const user = userEvent.setup();
  render(<FestivalsSection trip={trip} />);
  await user.click(
    await screen.findByRole('button', { name: '서울빛초롱축제 가고 싶은 곳에 넣기' }),
  );
  await waitFor(async () =>
    expect((await itemRepo.listByTrip(trip.id)).map((i) => [i.title, i.date])).toEqual([
      ['서울빛초롱축제', null],
    ]),
  );
});

it('항공편 지연: 출발 당일에만, 지연 분을 보여 준다', async () => {
  updateSettings({ flightDelay: true });
  vi.stubGlobal('fetch', async () =>
    Response.json({ status: { status: 'scheduled', depDelay: 35 } }),
  );
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const b = {
    id: 'b',
    tripId: 't',
    kind: 'flight',
    title: 'KE703',
    start: { date: today, timezone: 'Asia/Seoul' },
    details: { flightNo: 'KE 703' },
    createdAt: '',
    updatedAt: '',
  } as Booking;
  const { rerender } = render(
    <FlightDelay booking={{ ...b, start: { ...b.start, date: '2000-01-01' } }} />,
  );
  expect(screen.queryByText(/지연/)).toBeNull();
  rerender(<FlightDelay booking={b} />);
  expect(await screen.findByText('출발 약 35분 지연', { exact: false })).toBeInTheDocument();
});
