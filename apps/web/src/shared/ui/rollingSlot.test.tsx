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

it('늦게 뜬 칸도 같은 순간에 넘어간다 — 앱 전체가 시계 하나 (docs/31 §11 R2)', () => {
  vi.useFakeTimers();
  try {
    const { container } = render(
      <RollingSlot items={[<span key="a">1일차</span>, <span key="b">11.26</span>]} />,
    );
    act(() => vi.advanceTimersByTime(1500));
    // 날씨처럼 화면이 뜬 뒤 늦게 붙는 칸
    const late = render(
      <RollingSlot items={[<span key="a">맑음</span>, <span key="b">오늘</span>]} />,
    );
    const shown = (root: HTMLElement) => root.querySelector('.tp-roll')!.textContent;
    expect(shown(container)).toBe('1일차');
    expect(shown(late.container)).toBe('맑음');
    act(() => vi.advanceTimersByTime(1500));
    expect(shown(container)).toBe('11.26');
    expect(shown(late.container)).toBe('오늘');
  } finally {
    vi.useRealTimers();
  }
});

it('화면이 안 보이는 동안은 멈춘다', () => {
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, 'hidden', 'get');
  try {
    const { container } = render(
      <RollingSlot items={[<span key="a">맑음</span>, <span key="b">오늘</span>]} />,
    );
    hidden.mockReturnValue(true);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(9000));
    expect(container.querySelector('.tp-roll')).toHaveTextContent('맑음');
    hidden.mockReturnValue(false);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(3000));
    expect(container.querySelector('.tp-roll')).toHaveTextContent('오늘');
  } finally {
    hidden.mockRestore();
    vi.useRealTimers();
  }
});

it('움직임 줄이기면 6초마다 (docs/31 R3)', () => {
  vi.useFakeTimers();
  const orig = window.matchMedia;
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduced-motion') })) as never;
  try {
    render(<RollingSlot items={[<span key="a">맑음</span>, <span key="b">오늘</span>]} />);
    const shown = () => screen.getByText(/맑음|오늘/, { selector: '.tp-roll > span' });
    act(() => vi.advanceTimersByTime(3000));
    expect(shown()).toHaveTextContent('맑음');
    act(() => vi.advanceTimersByTime(3000));
    expect(shown()).toHaveTextContent('오늘');
  } finally {
    window.matchMedia = orig;
    vi.useRealTimers();
  }
});
