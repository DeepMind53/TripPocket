import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ConfirmHost } from '../../shared/ui';
import { AdminSuggestionsPage } from './AdminSuggestionsPage';

const row = (id: string, body: string, status: 'new' | 'read' | 'done') => ({
  id,
  body,
  hasImage: false,
  status,
  reply: null,
  createdAt: '2026-11-20T00:00:00Z',
  repliedAt: null,
  author: '여행자',
});
let rows: ReturnType<typeof row>[] = [];
const calls: string[] = [];
beforeEach(() => {
  calls.length = 0;
  rows = [row('a', '새로 온 제안', 'new'), row('b', '끝난 제안', 'done')];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (url === '/api/admin/suggestions') return Response.json({ suggestions: rows });
    if (method === 'DELETE') rows = rows.filter((r) => !url.endsWith(`/${r.id}`));
    return Response.json({ ok: true });
  });
});
afterEach(() => vi.unstubAllGlobals());

const open = () =>
  render(
    <>
      <RouterProvider
        router={createMemoryRouter([{ path: '/', element: <AdminSuggestionsPage /> }])}
      />
      <ConfirmHost />
    </>,
  );

it('완료한 제안은 숨기고 [완료 N개 보기]로 펼친다 (사용자 요청 2026-11-23)', async () => {
  const user = userEvent.setup();
  open();
  expect(await screen.findByText('새로 온 제안')).toBeInTheDocument();
  expect(screen.queryByText('끝난 제안')).toBeNull();
  await user.click(screen.getByRole('button', { name: '완료 1개 보기' }));
  expect(screen.getByText('끝난 제안')).toBeInTheDocument();
});

it('남은 게 모두 완료면 "처리할 제안이 없어요"', async () => {
  rows = [row('b', '끝난 제안', 'done')];
  open();
  expect(await screen.findByText('처리할 제안이 없어요')).toBeInTheDocument();
});

it('지우기: 확인 창에서 [삭제]를 눌러야 지운다', async () => {
  const user = userEvent.setup();
  open();
  const card = (await screen.findByText('새로 온 제안')).closest('article')!;
  await user.click(within(card).getByRole('button', { name: '제안 지우기' }));
  const dialog = await screen.findByRole('dialog', { name: '삭제할까요?' });
  expect(dialog).toHaveTextContent('이 제안을 삭제해요');
  await user.click(within(dialog).getByRole('button', { name: '삭제' }));
  await waitFor(() => expect(screen.queryByText('새로 온 제안')).toBeNull());
  expect(calls).toContain('DELETE /api/admin/suggestions/a');
});
