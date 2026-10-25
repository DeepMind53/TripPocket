import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { Toaster } from '../../shared/ui';

const calls: { url: string; method: string; type: string | undefined }[] = [];
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, method: init?.method ?? 'GET', type: headers['content-type'] });
    if (url === '/api/suggestions' && init?.method === 'POST')
      return Response.json({ id: '0190f2a4-0000-7000-8000-00000000000a' });
    if (url === '/api/suggestions/mine')
      return Response.json({
        suggestions: [
          {
            id: 'x',
            body: '예전 제안',
            hasImage: false,
            status: 'done',
            reply: '반영했어요',
            createdAt: '2026-10-20T00:00:00Z',
            repliedAt: null,
          },
        ],
      });
    return Response.json({ ok: true });
  });
});
afterEach(() => vi.unstubAllGlobals());

it('개선 제안: 글 + 사진 1장 보내기, 10MB 넘는 사진은 막고, 받은 답장을 본다', async () => {
  const user = userEvent.setup();
  render(
    <>
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/me/suggestions'] })}
      />
      <Toaster />
    </>,
  );
  expect(await screen.findByText('반영했어요')).toBeInTheDocument();
  await user.type(screen.getByLabelText('내용'), '지도에 즐겨찾기를 보여 주세요');
  const pick = screen.getByLabelText('+ 사진 1장 붙이기 (10MB까지)');
  await user.upload(
    pick,
    new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }),
  );
  expect(await screen.findByText(/10MB가 넘는 사진/)).toBeInTheDocument();
  await user.upload(pick, new File(['png'], 'shot.png', { type: 'image/png' }));
  expect(screen.getByText('shot.png')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '보내기' }));
  await waitFor(() =>
    expect(calls.some((c) => c.url.endsWith('/image') && c.type === 'image/png')).toBe(true),
  );
  expect(await screen.findByText(/보냈어요/)).toBeInTheDocument();
});
