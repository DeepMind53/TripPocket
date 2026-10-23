import { fireEvent, render, screen } from '@testing-library/react';
import { FloatingQuickButton } from './FloatingQuickButton';

beforeEach(() => localStorage.removeItem('tp-quick-fab'));

describe('빠른 메뉴 플로팅 버튼', () => {
  it('처음엔 오른쪽 가운데보다 아래, 누르면 메뉴를 연다', () => {
    const onOpen = vi.fn();
    render(<FloatingQuickButton label="빠른 메뉴" onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: '빠른 메뉴' });
    expect(btn.style.right).not.toBe('');
    expect(parseFloat(btn.style.top)).toBeGreaterThan(window.innerHeight / 2);
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('누른 채 끌어 놓으면 가까운 옆(왼쪽)에 붙고 저장, 메뉴는 열지 않는다', () => {
    const onOpen = vi.fn();
    render(<FloatingQuickButton label="빠른 메뉴" onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: '빠른 메뉴' });
    fireEvent.pointerDown(btn, { clientX: 300, clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(btn, { clientX: 200, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(btn, { clientX: 40, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(btn, { clientX: 40, clientY: 300, pointerId: 1 });
    fireEvent.click(btn);
    expect(onOpen).not.toHaveBeenCalled();
    expect(btn.style.left).not.toBe('');
    expect(JSON.parse(localStorage.getItem('tp-quick-fab')!)).toMatchObject({ side: 'left' });
  });
});
