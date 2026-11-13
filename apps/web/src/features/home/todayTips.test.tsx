import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ItineraryItem, Trip } from '@trippocket/shared';
import { updateSettings } from '../../data/settingsStore';
import { ShorterOrderHint } from '../itinerary/ShorterOrderHint';
import { SpeakButton } from '../phrases/SpeakButton';
import { TodayTips } from './TodayTips';

const OFF = { phraseOfDay: false, bestWalkTime: false, daylightLeft: false, shorterOrder: false };
afterEach(() => {
  updateSettings(OFF);
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

it('여행 중 오늘 (설정 "일정"): 켠 것만 — 오늘의 한마디·걷기 좋은 시간·해 지기까지', () => {
  const code = Array<number>(24).fill(0);
  const temp = Array<number>(24).fill(18);
  const props = {
    trip: osaka,
    today: '2026-11-03',
    dayN: 1,
    now: '15:30',
    weather: { code: 0, min: 12, max: 20, hours: { code, temp } },
    coords: { lat: 34.67, lng: 135.5 },
  };
  const { rerender, container } = render(<TodayTips {...props} />);
  expect(container).toBeEmptyDOMElement();
  updateSettings({ phraseOfDay: true, bestWalkTime: true, daylightLeft: true });
  rerender(<TodayTips {...props} />);
  // 1일차 = 첫 문장 "안녕하세요"
  expect(screen.getByRole('region', { name: '오늘의 한마디' })).toHaveTextContent('こんにちは');
  expect(screen.getByText(/걷기 좋은 시간 15~22시/)).toBeInTheDocument();
  // 오사카 11월 일몰 약 16:55 → 1시간 남짓
  expect(screen.getByText(/해 지기까지 1시간 \d+분/)).toBeInTheDocument();
});

it('더 짧은 순서 (설정 "일정"): 바꾸지 않고 알려만', () => {
  const at = (id: string, lng: number) =>
    ({
      id,
      tripId: 't1',
      kind: 'place',
      title: id,
      date: '2026-11-03',
      place: { name: id, coords: { lat: 35, lng } },
    }) as ItineraryItem;
  const items = [at('A', 135), at('C', 135.2), at('B', 135.1)];
  const { rerender, container } = render(<ShorterOrderHint items={items} />);
  expect(container).toBeEmptyDOMElement();
  updateSettings({ shorterOrder: true });
  rerender(<ShorterOrderHint items={items} />);
  expect(screen.getByText(/순서를 바꾸면 약 [\d.]+km 짧아요/)).toHaveTextContent('A → B → C');
});
