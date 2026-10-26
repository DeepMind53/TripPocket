import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb } from '../../data/dev';
import { Toaster } from '../../shared/ui';

const admin = {
  id: 'u1',
  nickname: '관리자',
  createdAt: '2026-10-23',
  providers: ['kakao'],
  isAdmin: true,
};

function mockServer() {
  const calls: string[] = [];
  let approved = false;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === '/api/me') return Response.json(admin);
    if (url === '/api/admin/users')
      return Response.json({
        requests: approved
          ? []
          : [
              {
                id: 'naver:N-2',
                provider: 'naver',
                nickname: '친구',
                status: 'pending',
                requestedAt: '2026-10-23T01:00:00Z',
              },
            ],
        users: [
          { ...admin, status: 'active', lastSeenAt: null },
          {
            id: 'u2',
            nickname: '가족',
            status: 'active',
            isAdmin: false,
            createdAt: '',
            providers: ['google'],
            lastSeenAt: '2026-10-22T00:00:00Z',
          },
        ],
      });
    if (url.endsWith('/approve')) {
      approved = true;
      return Response.json({ ok: true });
    }
    if (init?.method === 'POST') return Response.json({ ok: true });
    return Response.json({ error: 'not_found' }, { status: 404 });
  });
  return calls;
}

const renderAt = (path: string) =>
  render(
    <>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
      <Toaster />
    </>,
  );

beforeEach(async () => {
  await resetLocalDb();
  useAuth.setState({ status: 'unknown', me: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('사용자 관리', () => {
  it('관리자: 마이에 메뉴 → 가입 요청 승인, 다른 사용자 사용 중지', async () => {
    const calls = mockServer();
    const user = userEvent.setup();
    renderAt('/me');
    await user.click(await screen.findByRole('link', { name: '사용자 관리' }));
    const pending = (await screen.findByText('친구')).closest('li')!;
    await user.click(within(pending).getByRole('button', { name: '승인' }));
    expect(calls).toContain('POST /api/admin/requests/naver%3AN-2/approve');
    expect(await screen.findByText('새 가입 요청이 없어요')).toBeInTheDocument();

    const family = screen.getByText('가족').closest('li')!;
    await user.click(within(family).getByRole('button', { name: '사용 중지' }));
    await waitFor(() => expect(calls).toContain('POST /api/admin/users/u2/disable'));
    // 관리자 자신에게는 중지 버튼이 없다
    const self = screen
      .getAllByText('관리자')
      .find((el) => el.closest('li'))!
      .closest('li')!;
    expect(within(self).queryByRole('button')).toBeNull();
  });

  it('관리자가 아니면 메뉴가 없고, 주소로 들어와도 안내만', async () => {
    mockServer();
    useAuth.setState({ status: 'user', me: { ...admin, isAdmin: false } });
    renderAt('/admin/users');
    expect(await screen.findByText('관리자만 볼 수 있어요')).toBeInTheDocument();
  });

  it.each(['/admin/users', '/admin/api-usage', '/admin/suggestions', '/admin/ai'])(
    '관리자가 아니면 %s 주소로 들어와도 잠금 화면, 관리자 API를 부르지 않는다',
    async (path) => {
      const calls: string[] = [];
      vi.stubGlobal('fetch', async (url: string) => {
        calls.push(url);
        if (url === '/api/me') return Response.json({ ...admin, isAdmin: false });
        return Response.json({ error: 'forbidden' }, { status: 403 });
      });
      useAuth.setState({ status: 'user', me: { ...admin, isAdmin: false } });
      renderAt(path);
      expect(await screen.findByText('관리자만 볼 수 있어요')).toBeInTheDocument();
      expect(calls.filter((u) => u.startsWith('/api/admin') || u.includes('/ai/collect'))).toEqual(
        [],
      );
    },
  );

  it('관리자: 마이에서 월간 갱신 요청문을 열어 그대로 복사', async () => {
    mockServer();
    useAuth.setState({ status: 'user', me: admin });
    const user = userEvent.setup();
    renderAt('/me');
    await user.click(await screen.findByRole('button', { name: '월간 갱신 요청문' }));
    const sheet = await screen.findByRole('dialog', { name: '월간 갱신 요청문' });
    expect(sheet).toHaveTextContent('월간 정보 갱신을 해 줘');
    expect(sheet).toHaveTextContent('emergency.ts');
    await user.click(within(sheet).getByRole('button', { name: '요청문 복사' }));
    expect(await navigator.clipboard.readText()).toMatch(/^트립포켓 \d{4}-\d{2} 월간 정보 갱신/);
  });
});
