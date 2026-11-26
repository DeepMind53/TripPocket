import { act, render, screen } from '@testing-library/react';
import { Toaster } from './Toaster';
import { snackbar, toast, useToastStore } from './toastStore';

afterEach(() => act(() => useToastStore.setState({ items: [] })));

it('고정 알림(업데이트 안내)은 하단 탭 바로 위 따로, 다른 알림이 와도 닫히지 않는다 (2026-11-26)', () => {
  render(<Toaster />);
  act(() => {
    useToastStore.getState().show({
      message: '새 버전이 있어요',
      action: { label: '업데이트', onAction: () => {} },
      duration: 600_000,
      pinned: true,
    });
  });
  act(() => {
    snackbar('삭제했어요', { label: '실행 취소', onAction: () => {} });
    toast('복사했어요');
  });
  const pinned = document.querySelector('[data-toaster-pinned]')!;
  expect(pinned).toHaveTextContent('새 버전이 있어요');
  expect(pinned.getAttribute('style')).toContain('--tp-bottom-inset');
  expect(pinned.getAttribute('style')).not.toContain('--toast-lift');
  expect(document.querySelector('[data-toaster]')).not.toHaveTextContent('새 버전이 있어요');
  expect(screen.getByText('복사했어요')).toBeInTheDocument();
});
