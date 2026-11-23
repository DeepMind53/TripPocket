import { fireEvent, render, screen } from '@testing-library/react';
import { ScrollRow } from './ScrollRow';

it('오른쪽에 더 있으면 끝을 흐리게 — 끝까지 밀면 흐림이 사라진다 (› 동그라미는 없음, 2026-11-23)', () => {
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
  const row = screen.getByRole('toolbar');
  expect(row.className).toContain('mask-image');
  expect(row.parentElement!.querySelector('svg')).toBeNull();
  sizes.scrollLeft = 300;
  fireEvent.scroll(row);
  expect(row.className).not.toContain('mask-image');
  for (const k of Object.keys(sizes))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});
