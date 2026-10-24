import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { resetLocalDb } from '../data/dev';
import { tripRepo } from '../data/repositories/tripRepo';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

let tripId = '';

beforeEach(async () => {
  await resetLocalDb();
  const trip = await tripRepo.create({
    title: '도쿄 가을여행',
    destinations: [{ name: '도쿄', kind: 'city', countryCode: 'JP' }],
    startDate: '2026-10-24',
    endDate: '2026-10-28',
    timezone: 'Asia/Tokyo',
    cover: { emoji: '🗼' },
  });
  tripId = trip.id;
});

describe('앱 셸', () => {
  it('앱 하단 탭 4개가 있고 현재 탭을 표시한다', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    for (const name of ['홈', '기록', '저장', '마이']) {
      expect(nav).toContainElement(screen.getByRole('link', { name }));
    }
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page');
  });

  it('탭을 누르면 화면이 바뀐다', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    await user.click(screen.getByRole('link', { name: '기록' }));
    // 홈 밖의 탭은 지연 로딩 — 화면을 불러온 뒤 이동이 끝난다
    expect(await screen.findByRole('heading', { name: '기록' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/records');
  });

  it('여행 상세는 여행 탭 4개를 보여주고 기본은 일정 탭이다', async () => {
    const router = renderAt(`/trips/${tripId}`);
    const nav = await screen.findByRole('navigation', { name: '여행 메뉴' });
    await screen.findAllByText('아직 일정이 없어요');
    expect(router.state.location.pathname).toBe(`/trips/${tripId}/plan`);
    for (const name of ['일정', '장소', '예약', '준비']) {
      expect(nav).toContainElement(screen.getByRole('link', { name }));
    }
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
  });

  it('빠른 메뉴는 뒤로가기로 닫힌다', async () => {
    const user = userEvent.setup();
    const router = renderAt(`/trips/${tripId}/plan`);
    await screen.findByRole('heading', { name: '🗼 도쿄 가을여행' });
    await user.click(screen.getByRole('button', { name: '빠른 메뉴' }));
    expect(screen.getByRole('dialog', { name: '빠른 메뉴' })).toBeInTheDocument();
    // 여행 안에서는 바로가기가 보인다
    expect(screen.getByText('숙소로 길찾기')).toBeInTheDocument();

    await act(async () => {
      await router.navigate(-1);
    });
    expect(screen.queryByRole('dialog', { name: '빠른 메뉴' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/trips/${tripId}/plan`);
  });

  it('없는 주소는 안내 화면을 보여준다', () => {
    renderAt('/없는-주소');
    expect(screen.getByText('페이지를 찾을 수 없어요')).toBeInTheDocument();
  });

  it('뒤로 버튼이 있는 화면에는 왼쪽에 홈 버튼이 있고, 누르면 홈으로 간다', async () => {
    const user = userEvent.setup();
    const router = renderAt(`/trips/${tripId}/plan`);
    const home = await screen.findByRole('button', { name: '홈으로' });
    const back = screen.getByRole('button', { name: '뒤로' });
    // 홈 버튼이 뒤로 버튼보다 앞(왼쪽)에 있다
    expect(home.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(home);
    expect(router.state.location.pathname).toBe('/');
  });

  it('홈 화면 헤더에는 홈·뒤로 버튼이 없다', () => {
    renderAt('/');
    expect(screen.queryByRole('button', { name: '홈으로' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로' })).not.toBeInTheDocument();
  });
});
