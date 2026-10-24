import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { useAuth } from '../data/authStore';
import { routes } from './router';

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe('로그인한 사람만 앱을 쓴다', () => {
  beforeEach(() => vi.stubGlobal('fetch', async () => Response.json({ providers: ['kakao'] })));
  afterEach(() => vi.unstubAllGlobals());

  it('로그인 안 됨(401) → 어느 화면이든 로그인 화면으로, 돌아갈 주소를 기억', async () => {
    localStorage.removeItem('tp-signed-in');
    useAuth.setState({ status: 'anon', me: null });
    renderAt('/trips');
    expect(await screen.findByText(/로그인 후 쓸 수 있어요/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '카카오로 시작하기' })).toHaveAttribute(
      'href',
      '/auth/kakao/start?returnTo=%2Ftrips',
    );
    // 로그인 전에는 돌아갈 화면이 없으므로 뒤로·홈 버튼 없음
    expect(screen.queryByRole('button', { name: '홈' })).not.toBeInTheDocument();
  });

  it('한 번도 로그인 안 한 기기는 서버에 닿지 않아도 로그인 화면', async () => {
    localStorage.removeItem('tp-signed-in');
    useAuth.setState({ status: 'offline', me: null });
    renderAt('/');
    expect(await screen.findByText(/로그인 후 쓸 수 있어요/)).toBeInTheDocument();
  });

  it('로그인했던 기기는 오프라인에서도 앱이 열린다', async () => {
    useAuth.setState({ status: 'offline', me: null });
    renderAt('/trips');
    expect(await screen.findByRole('heading', { name: '내 여행' })).toBeInTheDocument();
  });

  it('법적 고지는 로그인 없이 볼 수 있다', async () => {
    localStorage.removeItem('tp-signed-in');
    useAuth.setState({ status: 'anon', me: null });
    renderAt('/legal/privacy');
    expect(await screen.findByText('1. 기본 원칙')).toBeInTheDocument();
  });
});
