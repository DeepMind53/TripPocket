import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Trip } from '@trippocket/shared';
import { resetLocalDb } from '../../data/dev';
import { setLab } from '../../data/labsStore';
import { SpeakButton } from '../phrases/SpeakButton';
import { TripCardSave } from '../records/TripCardSave';

afterEach(() => {
  for (const id of ['speakPhrase', 'tripStory'] as const) setLab(id, false, { silent: true });
  vi.unstubAllGlobals();
});

it('회화 소리로 듣기: 실험을 켜야 버튼, 그 말 목소리로 읽고 목소리가 없으면 안내', async () => {
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
  expect(screen.queryByRole('button', { name: '소리로 듣기' })).toBeNull();
  setLab('speakPhrase', true, { silent: true });
  rerender(<SpeakButton text="ありがとう" lang="ja" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '소리로 듣기' }));
  expect(spoken).toEqual([{ text: 'ありがとう', lang: 'ja-JP' }]);
  // 광둥어(zh-HK) 목소리가 없으면 표준 중국어로 잘못 읽지 않고 안내만
  rerender(<SpeakButton text="唔該" lang="zh-HK" />);
  await user.click(screen.getByRole('button', { name: '소리로 듣기' }));
  expect(spoken).toHaveLength(1);
});

it('여행기 글로 복사: 실험을 켜면 다녀온 여행마다 [글로] → 클립보드', async () => {
  await resetLocalDb();
  const copied: string[] = [];
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (s: string) => void copied.push(s) },
  });
  setLab('tripStory', true, { silent: true });
  const trip = {
    id: 't1',
    title: '도쿄 여행',
    startDate: '2026-10-27',
    endDate: '2026-10-28',
    destinations: [{ name: '도쿄' }],
    dayNotes: [{ date: '2026-10-27', text: '좋았어요' }],
  } as unknown as Trip;
  render(<TripCardSave pastTrips={[trip]} />);
  const btn = screen.getByRole('button', { name: '도쿄 여행 여행기 글로 복사' });
  await waitFor(() => expect(btn).toBeEnabled());
  await user.click(btn);
  expect(copied[0]).toBe('도쿄 여행 (2026.10.27 – 10.28)\n도쿄\n\n10.27 1일차\n한 줄: 좋았어요');
});
