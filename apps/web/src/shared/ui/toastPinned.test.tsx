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

it('⚡ 버튼과 같은 높이면 위로 올리지 않고 버튼 쪽만 비워 옆에 띄운다 (2026-11-26 사용자 요청)', () => {
  const rect = (l: number, t: number, w: number, h: number) =>
    ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h, x: l, y: t }) as DOMRect;
  const fab = document.createElement('button');
  fab.setAttribute('data-quick-fab', '');
  document.body.append(fab);
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([rect(0, 0, 1, 1)] as never);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    // 360px 화면: 알림 줄 전체 폭, ⚡ 버튼은 오른쪽 아래 (292~344px)
    if (this.hasAttribute('data-quick-fab')) return rect(292, 700, 52, 52);
    if (this.hasAttribute('data-toaster')) return rect(0, 690, 360, 60);
    return rect(0, 0, 0, 0);
  });
  render(<Toaster />);
  act(() => void toast('동기화했어요'));
  const box = document.querySelector<HTMLElement>('[data-toaster]')!;
  // 위로 올리지 않는다
  expect(box.style.getPropertyValue('--toast-lift')).toBe('0px');
  // 오른쪽만 비운다: 360 - 16 - (292 - 8) = 60 → 16 + 60
  expect(box.style.paddingRight).toBe('76px');
  expect(box.style.paddingLeft).toBe('');
  fab.remove();
  vi.restoreAllMocks();
});
