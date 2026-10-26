import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { db } from '../../data/db';
import { resetLocalDb, seedSampleTrip } from '../../data/dev';
import { Toaster } from '../../shared/ui';

const me = { id: 'u1', nickname: '여행자', createdAt: '2026-10-23', providers: ['kakao'] };

function mockServer(loggedIn: boolean) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === '/api/me')
      return loggedIn
        ? Response.json(me)
        : Response.json({ error: 'unauthorized' }, { status: 401 });
    if (url === '/auth/providers')
      return Response.json({ providers: ['kakao', 'naver', 'google'] });
    if (url === '/auth/logout') return Response.json({ ok: true });
    if (url === '/api/me/nickname')
      return Response.json({ nickname: JSON.parse(String(init?.body)).nickname });
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

describe('계정', () => {
  it('로그인 전: 마이를 열면 그 자리에서 로그인 화면, 켜진 제공자 버튼', async () => {
    mockServer(false);
    renderAt('/me');
    const kakao = await screen.findByRole('link', { name: '카카오로 시작하기' });
    expect(kakao).toHaveAttribute('href', '/auth/kakao/start?returnTo=%2Fme');
    expect(screen.getByRole('link', { name: 'Google로 시작하기' })).toBeInTheDocument();
  });

  it('초대받지 않은 계정이면 관리자에게 보낼 값을 보여 준다', async () => {
    mockServer(false);
    renderAt('/login?error=invite&account=google%3AG-3');
    expect(await screen.findByRole('alert')).toHaveTextContent('google:G-3');
  });

  it('서버가 없으면(앱 HTML 응답) 로그인 불가 안내, 앱은 그대로', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    );
    renderAt('/login');
    expect(await screen.findByText(/로그인 서버에 연결할 수 없어요/)).toBeInTheDocument();
  });

  it('로그인 후: 닉네임, 로그아웃하면서 이 기기 여행 지우기', async () => {
    const calls = mockServer(true);
    await seedSampleTrip();
    const user = userEvent.setup();
    renderAt('/me');
    expect(await screen.findByText('여행자')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /로그아웃/ }));
    const sheet = await screen.findByRole('dialog', { name: '로그아웃' });
    await user.click(within(sheet).getByRole('radio', { name: /이 기기의 여행도 지우기/ }));
    await user.click(within(sheet).getByRole('button', { name: '로그아웃' }));
    expect(await screen.findByText('로그아웃했어요')).toBeInTheDocument();
    expect(calls).toContain('POST /auth/logout');
    expect(await db.trips.count()).toBe(0);
    // 로그인한 사람만 앱을 쓰므로 로그아웃하면 로그인 화면으로
    expect(await screen.findByText(/로그인 후 쓸 수 있어요/)).toBeInTheDocument();
    expect(localStorage.getItem('tp-signed-in')).toBeNull();
  });

  it('닉네임 바꾸기: 계정 카드 연필 → 저장하면 서버에 보내고 바로 반영', async () => {
    const calls = mockServer(true);
    const user = userEvent.setup();
    renderAt('/me');
    await user.click(await screen.findByRole('button', { name: '닉네임 바꾸기' }));
    const sheet = await screen.findByRole('dialog', { name: '닉네임 바꾸기' });
    const input = within(sheet).getByLabelText('닉네임');
    await user.clear(input);
    expect(within(sheet).getByRole('button', { name: '저장' })).toBeDisabled();
    await user.type(input, '  하늘  ');
    await user.click(within(sheet).getByRole('button', { name: '저장' }));
    expect(await screen.findByText('닉네임을 바꿨어요')).toBeInTheDocument();
    expect(calls).toContain('PATCH /api/me/nickname');
    expect(await screen.findByText('하늘')).toBeInTheDocument();
  });
});

it('네이버 로그인을 누르면 먼저 "관리자에게 네이버 아이디 등록" 안내', async () => {
  mockServer(false);
  const user = userEvent.setup();
  renderAt('/login');
  await screen.findByRole('link', { name: '네이버로 시작하기' });
  // 카카오·구글은 안내 없이 바로
  expect(screen.getByRole('link', { name: '카카오로 시작하기' })).toHaveAttribute(
    'href',
    '/auth/kakao/start?returnTo=%2Fme',
  );
  await user.click(screen.getByRole('link', { name: '네이버로 시작하기' }));
  const sheet = await screen.findByRole('dialog', { name: '네이버 아이디 등록이 필요해요' });
  expect(within(sheet).getByText(/관리자에게 네이버 아이디를 알려/)).toBeInTheDocument();
  expect(
    within(sheet).getByRole('button', { name: '등록됐어요, 네이버로 계속' }),
  ).toBeInTheDocument();
});

it('로그인 전 화면: 맨 위 로고, 소개 카드 7장을 점으로 넘긴다', async () => {
  mockServer(false);
  renderAt('/login');
  expect(await screen.findByRole('heading', { name: '트립포켓' })).toBeInTheDocument();
  const intro = screen.getByRole('region', { name: '트립포켓 소개' });
  expect(within(intro).getAllByRole('group')).toHaveLength(7);
  expect(within(intro).getByRole('heading', { name: '⚡ 버튼 하나로' })).toBeInTheDocument();
  expect(within(intro).getByRole('heading', { name: '여행 일정을 한눈에' })).toBeInTheDocument();
  expect(within(intro).getByRole('button', { name: '1번째 소개 보기' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

it('홈 로고 옆 [도움말]에서 앱 소개를 언제든 다시 본다', async () => {
  mockServer(true);
  const user = userEvent.setup();
  renderAt('/');
  await user.click(await screen.findByRole('link', { name: '도움말' }));
  const intro = await screen.findByRole('region', { name: '트립포켓 소개' });
  expect(within(intro).getAllByRole('group')).toHaveLength(7);
});
