import { act, fireEvent, render, screen } from '@testing-library/react';
import { ScrollRow } from './ScrollRow';

it('오른쪽에 더 있으면 "밀어서 더 보기" — 미는 동안 숨고 멈추면 다시, 끝까지 밀면 사라짐', () => {
  vi.useFakeTimers();
  const sizes = { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 };
  for (const k of Object.keys(sizes) as (keyof typeof sizes)[])
    Object.defineProperty(HTMLElement.prototype, k, {
      configurable: true,
      get: () => sizes[k],
    });
  render(
    <ScrollRow role="toolbar" aria-label="칩">
      <button>a</button>
    </ScrollRow>,
  );
  const hint = screen.getByText('밀어서 더 보기');
  expect(hint.className).toContain('opacity-100');
  fireEvent.scroll(screen.getByRole('toolbar'));
  expect(hint.className).toContain('opacity-0');
  act(() => vi.advanceTimersByTime(800));
  expect(hint.className).toContain('opacity-100');
  sizes.scrollLeft = 300;
  fireEvent.scroll(screen.getByRole('toolbar'));
  act(() => vi.advanceTimersByTime(800));
  expect(hint.className).toContain('opacity-0');
  for (const k of Object.keys(sizes))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
  vi.useRealTimers();
});
