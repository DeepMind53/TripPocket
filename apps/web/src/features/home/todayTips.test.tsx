import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ItineraryItem, Trip } from '@trippocket/shared';
import { updateSettings } from '../../data/settingsStore';
import { ShorterOrderHint } from '../itinerary/ShorterOrderHint';
import { SpeakButton } from '../phrases/SpeakButton';
import { phraseAudioUrl } from '../../domain/phraseAudio';
import { TodayTips } from './TodayTips';
import { useToastStore } from '../../shared/ui/toastStore';

const OFF = { phraseOfDay: false, bestWalkTime: false, daylightLeft: false, shorterOrder: false };
// 아래 기기 읽기 시험은 음성 파일을 못 튼 경우 (jsdom은 소리를 틀지 못한다)
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
    Promise.reject(new Error('no audio')),
  );
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  updateSettings(OFF);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('소리로 듣기: 미리 만든 음성 파일을 먼저 틀고, 틀면 기기 읽기는 쓰지 않는다 (2026-11-26)', async () => {
  const played: string[] = [];
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    played.push(this.src);
    return Promise.resolve();
  });
  const speak = vi.fn();
  vi.stubGlobal('speechSynthesis', {
    speaking: false,
    getVoices: () => [],
    cancel: () => {},
    speak,
  });
  render(<SpeakButton text="ありがとう" lang="ja" />);
  await userEvent.setup().click(screen.getByRole('button', { name: '소리로 듣기' }));
  expect(played[0]).toContain(phraseAudioUrl('ja', 'ありがとう'));
  expect(speak).not.toHaveBeenCalled();
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

it('소리로 듣기: 아이폰 무음 모드에서도 들리게, 읽는 중에 다시 누르면 멈췄다가 새로 읽는다 (사용자 제보 2026-11-23)', async () => {
  const log: string[] = [];
  const session = { type: 'auto' };
  Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      lang = '';
      voice: unknown = null;
      rate = 1;
      constructor(public text: string) {}
    },
  );
  let speaking = false;
  vi.stubGlobal('speechSynthesis', {
    get speaking() {
      return speaking;
    },
    pending: false,
    getVoices: () => [
      { lang: 'ja-JP', name: 'Bells', localService: true, default: false },
      { lang: 'ja-JP', name: 'Kyoko', localService: true, default: true },
    ],
    cancel: () => log.push('cancel'),
    resume: () => log.push('resume'),
    speak: (u: { voice: { name: string } }) => {
      log.push(`speak ${u.voice.name}`);
      speaking = true;
    },
  });
  render(<SpeakButton text="ありがとう" lang="ja" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '소리로 듣기' }));
  expect(session.type).toBe('playback');
  // 기기 기본 목소리, 누른 그 순간 바로 (멈춤 상태가 아니면 resume을 부르지 않는다 — 2026-11-24 안드로이드 제보)
  expect(log).toEqual(['speak Kyoko']);
  await user.click(screen.getByRole('button', { name: '소리로 듣기' }));
  expect(log.slice(1)).toEqual(['cancel', 'speak Kyoko']);
  delete (navigator as Navigator & { audioSession?: unknown }).audioSession;
});

it('소리로 듣기: 안드로이드 중국어 목소리 이름(cmn-TW), 고른 목소리가 실패하면 언어만으로 한 번 더 (2026-11-24)', async () => {
  type U = {
    text: string;
    lang: string;
    voice: { name: string } | null;
    onerror?: (e: { error: string }) => void;
  };
  const spoken: U[] = [];
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
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [{ lang: 'cmn_TW', name: 'Google 國語', localService: true, default: false }],
    cancel: () => {},
    resume: () => {},
    speak: (u: U) => spoken.push(u),
  });
  render(<SpeakButton text="謝謝" lang="zh-TW" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '소리로 듣기' }));
  expect(spoken[0]).toMatchObject({ lang: 'cmn-TW', voice: { name: 'Google 國語' } });
  spoken[0]!.onerror?.({ error: 'synthesis-failed' });
  expect(spoken[1]).toMatchObject({ lang: 'zh-TW', voice: null });
  spoken[1]!.onerror?.({ error: 'synthesis-failed' });
  expect(useToastStore.getState().items.at(-1)?.message).toMatch(/그 말 목소리가 없어요/);
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
