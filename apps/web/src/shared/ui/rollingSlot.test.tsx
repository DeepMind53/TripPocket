import { act, render, screen } from '@testing-library/react';
import { RollingSlot } from './RollingSlot';

it('날짜 머리 오른쪽: 3초마다 다음 정보, 안 보이는 것도 스크린리더에는 남는다', () => {
  vi.useFakeTimers();
  try {
    render(<RollingSlot items={[<span key="a">맑음</span>, <span key="b">오늘</span>]} />);
    const shown = () => screen.getByText(/맑음|오늘/, { selector: '.tp-roll > span' });
    expect(shown()).toHaveTextContent('맑음');
    expect(screen.getByText('오늘').parentElement).toHaveClass('sr-only');
    act(() => vi.advanceTimersByTime(3000));
    expect(shown()).toHaveTextContent('오늘');
    expect(screen.getByText('맑음').parentElement).toHaveClass('sr-only');
  } finally {
    vi.useRealTimers();
  }
});

it('하나뿐이면 굴리지 않는다', () => {
  render(<RollingSlot items={[<span key="a">맑음</span>]} />);
  expect(screen.getByText('맑음').parentElement).not.toHaveClass('tp-roll');
});
