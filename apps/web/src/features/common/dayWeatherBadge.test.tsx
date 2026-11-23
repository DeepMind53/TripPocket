import { act, render, screen } from '@testing-library/react';
import { DayWeatherBadge } from './DayWeatherBadge';

const base = { code: 0, min: 12, max: 20 };

it('작년 기록이면 "과거 날씨" ↔ 그림·기온을 한 칸에서 번갈아, 칸 폭은 고정 (2026-11-23)', () => {
  vi.useFakeTimers();
  try {
    const { container } = render(<DayWeatherBadge weather={{ ...base, year: 2025 }} />);
    const visible = () => container.querySelector('.tp-roll')!;
    expect(visible()).toHaveTextContent('과거 날씨');
    act(() => vi.advanceTimersByTime(3000));
    expect(visible()).not.toHaveTextContent('과거 날씨');
    expect(visible()).toHaveTextContent('20');
    // 두 항목 모두 보이지 않게 겹쳐 자리를 잡는다 (폭 고정)
    expect(container.querySelectorAll('.invisible')).toHaveLength(2);
    // 스크린리더에는 전체 설명 하나
    expect(screen.getByRole('img')).toHaveAccessibleName(/2025/);
  } finally {
    vi.useRealTimers();
  }
});

it('예보면 굴리지 않고 그림·기온만', () => {
  const { container } = render(<DayWeatherBadge weather={base} />);
  expect(container.querySelector('.tp-roll')).toBeNull();
  expect(screen.queryByText('과거 날씨')).toBeNull();
});
