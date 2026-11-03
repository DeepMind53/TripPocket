import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SHORTCUTS, setQuickShortcuts, useQuickShortcuts } from './quickShortcuts';
import { ShortcutEditSheet } from './ShortcutEditSheet';

/** 빠른 메뉴 바로가기 편집 (사용자 요청 2026-11-02): 4개까지 고른 순서대로, 이 기기에 저장 */
afterEach(() => {
  setQuickShortcuts(DEFAULT_SHORTCUTS);
  localStorage.removeItem('tp-quick-shortcuts');
});

it('하나를 빼고 다른 것을 넣으면 고른 순서대로 저장, 4개가 차면 나머지는 못 고른다', async () => {
  const user = userEvent.setup();
  render(<ShortcutEditSheet open onOpenChange={() => {}} />);
  await user.click(await screen.findByRole('button', { name: /준비물/ }));
  await user.click(screen.getByRole('button', { name: /날씨 정보/ }));
  expect(screen.getByRole('button', { name: /도움말/ })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '저장' }));
  expect(useQuickShortcuts.getState().ids).toEqual(['lodging', 'bookingNo', 'nextItem', 'weather']);
  expect(JSON.parse(localStorage.getItem('tp-quick-shortcuts')!)).toHaveLength(4);
});
