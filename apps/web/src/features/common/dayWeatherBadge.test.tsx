import { act, render, screen } from '@testing-library/react';
import { RollingSlot } from '../../shared/ui';
import { DayWeatherBadge } from './DayWeatherBadge';

const base = { code: 0, min: 12, max: 20 };

it('작년 기록이면 "작년 기록" ↔ 그림·기온을 한 칸에서 번갈아, 칸 폭은 고정 (2026-11-23)', () => {
  vi.useFakeTimers();
  try {
    const { container } = render(<DayWeatherBadge weather={{ ...base, year: 2025 }} />);
    const visible = () => container.querySelector('.tp-roll')!;
    expect(visible()).toHaveTextContent('작년 기록');
    act(() => vi.advanceTimersByTime(3000));
    expect(visible()).not.toHaveTextContent('작년 기록');
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
  expect(screen.queryByText('작년 기록')).toBeNull();
});

it('Plan B와 함께 바깥 전광판에 펼치면 작년 기록·기온·Plan B가 모두 차례로 보인다 (docs/31 §11 R2)', () => {
  vi.useFakeTimers();
  try {
    const w = { ...base, year: 2025 };
    const { container } = render(
      <RollingSlot
        items={[
          <DayWeatherBadge key="wp" weather={w} part="past" />,
          <DayWeatherBadge key="w" weather={w} part="info" />,
          <span key="plan">Plan B</span>,
        ]}
      />,
    );
    const seen: string[] = [];
    for (let k = 0; k < 3; k++) {
      seen.push(container.querySelector('.tp-roll')!.textContent ?? '');
      act(() => vi.advanceTimersByTime(3000));
    }
    expect(seen).toEqual(['작년 기록', '12°/20°', 'Plan B']);
    // 따로 굴리지 않는다 — 전광판은 바깥 하나
    expect(container.querySelectorAll('.tp-roll')).toHaveLength(1);
    // 스크린리더: "작년 기록" 글자는 숨기고 작년 설명 하나만
    expect(screen.getByRole('img')).toHaveAccessibleName(/2025/);
  } finally {
    vi.useRealTimers();
  }
});
