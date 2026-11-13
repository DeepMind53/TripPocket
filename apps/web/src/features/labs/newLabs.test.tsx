import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Booking, ItineraryItem, Trip } from '@trippocket/shared';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { resetLocalDb } from '../../data/dev';
import { LABS, setLab } from '../../data/labsStore';
import { tripRepo } from '../../data/repositories/tripRepo';
import { SpeakButton } from '../phrases/SpeakButton';
import { BookingCheck } from './BookingCheck';
import { DayLabs } from './DayLabs';
import { MemoryToday } from './MemoryToday';
import { TodayLabs } from './TodayLabs';

afterEach(() => {
  for (const id of LABS) setLab(id, false, { silent: true });
  vi.unstubAllGlobals();
});

it('회화 소리로 듣기 (정식, 늘 켜짐): 그 말 목소리로 읽고 목소리가 없으면 안내', async () => {
  const spoken: { text: string; lang: string }[] = [];
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      lang = '';
      voice: unknown = null;
      rate = 1;
      constructor(public text: string) {}
    },
  );
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [{ lang: 'ja-JP' }, { lang: 'en-US' }],
    cancel: () => {},
    speak: (u: { text: string; lang: string }) => spoken.push({ text: u.text, lang: u.lang }),
  });
  const { rerender } = render(<SpeakButton text="ありがとう" lang="ja" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '소리로 듣기' }));
  expect(spoken).toEqual([{ text: 'ありがとう', lang: 'ja-JP' }]);
  // 광둥어(zh-HK) 목소리가 없으면 표준 중국어로 잘못 읽지 않고 안내만
  rerender(<SpeakButton text="唔該" lang="zh-HK" />);
  await user.click(screen.getByRole('button', { name: '소리로 듣기' }));
  expect(spoken).toHaveLength(1);
});

const osaka = {
  id: 't1',
  title: '오사카',
  timezone: 'Asia/Tokyo',
  startDate: '2026-11-03',
  endDate: '2026-11-05',
  destinations: [{ name: '오사카', kind: 'city', countryCode: 'JP' }],
} as unknown as Trip;

it('여행 중 실험: 켠 것만 — 오늘의 한마디·걷기 좋은 시간·숙소 알려 주기', async () => {
  const code = Array<number>(24).fill(0);
  const temp = Array<number>(24).fill(18);
  const stay = {
    id: 'b1',
    kind: 'lodging',
    title: '난바 호텔',
    start: { date: '2026-11-03' },
    end: { date: '2026-11-05' },
    details: { address: '오사카 주오구 1-1' },
  } as Booking;
  const props = {
    trip: osaka,
    today: '2026-11-03',
    dayN: 1,
    now: '13:10',
    weather: { code: 0, min: 12, max: 20, hours: { code, temp } },
    coords: { lat: 34.67, lng: 135.5 },
    stay,
  };
  const { rerender, container } = render(<TodayLabs {...props} />);
  expect(container).toBeEmptyDOMElement();
  setLab('phraseOfDay', true, { silent: true });
  setLab('bestWalkTime', true, { silent: true });
  setLab('shareStay', true, { silent: true });
  rerender(<TodayLabs {...props} />);
  // 1일차 = 첫 문장 "안녕하세요"
  expect(screen.getByRole('region', { name: '오늘의 한마디' })).toHaveTextContent('こんにちは');
  expect(screen.getByText(/걷기 좋은 시간 13~22시/)).toBeInTheDocument();
  const user = userEvent.setup();
  const copied: string[] = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (s: string) => void copied.push(s) },
  });
  await user.click(screen.getByRole('button', { name: '숙소 알려 주기' }));
  await waitFor(() =>
    expect(copied[0]).toBe('오늘 밤 숙소: 난바 호텔\n오사카 주오구 1-1\n체크아웃: 2026-11-05'),
  );
});

it('일정 하루 실험: 더 짧은 순서 (바꾸지 않고 알려만)', () => {
  setLab('shorterOrder', true, { silent: true });
  const at = (id: string, lng: number) =>
    ({
      id,
      tripId: 't1',
      kind: 'place',
      title: id,
      date: '2026-11-03',
      place: { name: id, coords: { lat: 35, lng } },
    }) as ItineraryItem;
  render(<DayLabs items={[at('A', 135), at('C', 135.2), at('B', 135.1)]} />);
  expect(screen.getByText(/순서를 바꾸면 약 [\d.]+km 짧아요/)).toHaveTextContent('A → B → C');
});

it('예약 날짜 점검: 여행 기간 밖 날짜와 늦은 도착', () => {
  setLab('bookingCheck', true, { silent: true });
  render(
    <BookingCheck
      trip={osaka}
      bookings={[
        {
          id: 'f1',
          kind: 'flight',
          title: 'KE723',
          start: { date: '2026-11-03' },
          end: { date: '2026-11-03', time: '22:40' },
        } as Booking,
        { id: 't', kind: 'tour', title: '유니버설', start: { date: '2026-12-04' } } as Booking,
      ]}
    />,
  );
  expect(screen.getByText(/여행 기간 밖 날짜예요/)).toHaveTextContent('유니버설 12.04');
  expect(screen.getByText(/늦은 체크인/)).toHaveTextContent('KE723 22:40 도착');
});

it('몇 년 전 오늘: 지난해 오늘 여행 중이었으면 그날 일정으로', async () => {
  await resetLocalDb();
  const trip = await tripRepo.create({
    title: '타이베이',
    destinations: [{ name: '타이베이', kind: 'city', countryCode: 'TW' }],
    startDate: '2025-11-12',
    endDate: '2025-11-15',
    timezone: 'Asia/Taipei',
    cover: {},
  });
  setLab('memoryToday', true, { silent: true });
  const router = createMemoryRouter([{ path: '/', element: <MemoryToday today="2026-11-13" /> }]);
  render(<RouterProvider router={router} />);
  const link = await screen.findByRole('link', { name: /1년 전 오늘/ });
  expect(link).toHaveTextContent('타이베이 2일차');
  expect(link).toHaveAttribute('href', `/trips/${trip.id}/plan?day=2`);
});
