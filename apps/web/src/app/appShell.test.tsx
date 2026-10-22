import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('앱 셸', () => {
  it('앱 하단 탭 4개가 있고 현재 탭을 표시한다', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    for (const name of ['홈', '내 여행', '저장', '마이']) {
      expect(nav).toContainElement(screen.getByRole('link', { name }));
    }
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page');
  });

  it('탭을 누르면 화면이 바뀐다', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    await user.click(screen.getByRole('link', { name: '내 여행' }));
    expect(router.state.location.pathname).toBe('/trips');
    expect(screen.getByRole('heading', { name: '내 여행' })).toBeInTheDocument();
  });

  it('여행 상세는 여행 탭 4개를 보여주고 기본은 일정 탭이다', () => {
    const router = renderAt('/trips/demo');
    expect(router.state.location.pathname).toBe('/trips/demo/plan');
    const nav = screen.getByRole('navigation', { name: '여행 메뉴' });
    for (const name of ['일정', '장소', '예약', '준비']) {
      expect(nav).toContainElement(screen.getByRole('link', { name }));
    }
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
  });

  it('빠른 메뉴는 뒤로가기로 닫힌다', async () => {
    const user = userEvent.setup();
    const router = renderAt('/trips/demo/plan');
    await user.click(screen.getByRole('button', { name: '빠른 메뉴' }));
    expect(screen.getByRole('dialog', { name: '빠른 메뉴' })).toBeInTheDocument();
    // 여행 안에서는 바로가기가 보인다
    expect(screen.getByText('숙소로 길찾기')).toBeInTheDocument();

    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.queryByRole('dialog', { name: '빠른 메뉴' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/trips/demo/plan');
  });

  it('없는 주소는 안내 화면을 보여준다', () => {
    renderAt('/없는-주소');
    expect(screen.getByText('페이지를 찾을 수 없어요')).toBeInTheDocument();
  });
});
