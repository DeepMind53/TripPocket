import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { tripRepo } from '../../data/repositories/tripRepo';

beforeEach(async () => {
  await resetLocalDb();
});

it('처음 쓰는 사람: 샘플 여행으로 둘러보기 → 샘플 여행 일정으로', async () => {
  const user = userEvent.setup();
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(<RouterProvider router={router} />);
  await user.click(await screen.findByRole('button', { name: '샘플 여행으로 둘러보기' }));
  await screen.findByRole('toolbar', { name: '날짜 선택' });
  expect(router.state.location.pathname).toMatch(/^\/trips\/.+\/plan$/);
  expect(await tripRepo.listActive()).toHaveLength(1);
});

it('⚡ 버튼 말풍선은 처음 한 번만', async () => {
  localStorage.removeItem('tp-quick-hint');
  const user = userEvent.setup();
  const { unmount } = render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/me'] })} />,
  );
  const hint = await screen.findByRole('button', { name: /자주 쓰는 기능은 여기/ });
  await user.click(hint);
  expect(screen.queryByRole('button', { name: /자주 쓰는 기능은 여기/ })).not.toBeInTheDocument();
  unmount();
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/me'] })} />);
  await screen.findByRole('button', { name: '빠른 메뉴' });
  expect(screen.queryByRole('button', { name: /자주 쓰는 기능은 여기/ })).not.toBeInTheDocument();
});
