import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb } from '../../data/dev';
import { Toaster } from '../../shared/ui';

const admin = { id: 'a', nickname: '관리자', createdAt: '', providers: ['kakao'], isAdmin: true };

const row = (id: string, group: 'paid' | 'free', over: object = {}) => ({
  id,
  group,
  freeMonthly: group === 'paid' ? 5000 : null,
  autoLimit: group === 'paid' ? 4500 : null,
  used: 0,
  today: 0,
  daily: [],
  paused: false,
  autoStopped: false,
  ...over,
});

beforeEach(async () => {
  await resetLocalDb();
  useAuth.setState({ status: 'unknown', me: null });
});
afterEach(() => vi.unstubAllGlobals());

it('관리자: 마이 → API 사용량, 과금 가능 API는 % 게이지·상태, 중지 누르면 서버에 반영', async () => {
  const bodies: string[] = [];
  let paused = false;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === '/api/me') return Response.json(admin);
    if (url.startsWith('/api/admin/api-usage')) {
      if (init?.method === 'POST') {
        bodies.push(`${url} ${String(init.body)}`);
        paused = true;
      }
      return Response.json({
        month: '2026-10',
        apis: [
          row('google_places_search', 'paid', {
            used: 2500,
            today: 12,
            paused,
            daily: [{ date: '2026-10-24', count: 12 }],
          }),
          row('google_maps_js', 'paid', {
            used: 9000,
            freeMonthly: 10000,
            autoLimit: 9000,
            autoStopped: true,
          }),
          row('gemini', 'free', { used: 30, today: 3 }),
        ],
      });
    }
    return Response.json({ error: 'not_found' }, { status: 404 });
  });
  const user = userEvent.setup();
  render(
    <>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/me'] })} />
      <Toaster />
    </>,
  );
  await user.click(await screen.findByRole('link', { name: 'API 사용량' }));
  const meter = await screen.findByRole('meter', { name: 'Google 장소 검색 무료 사용량 대비' });
  expect(meter).toHaveAttribute('aria-valuenow', '50');
  expect(screen.getByText('2,500 / 5,000 (50.0%)')).toBeInTheDocument();
  expect(screen.getByText('자동 중지')).toBeInTheDocument(); // 지도: 상한 도달
  expect(screen.getByText('이번 달 30회 · 오늘 3회')).toBeInTheDocument(); // 무료 API

  await user.click(screen.getByRole('button', { name: 'Google 장소 검색 중지' }));
  await waitFor(() =>
    expect(bodies).toEqual(['/api/admin/api-usage/google_places_search {"paused":true}']),
  );
  const card = screen.getByRole('heading', { name: 'Google 장소 검색' }).closest('article')!;
  expect(await within(card).findByText('수동 중지')).toBeInTheDocument();
});

it('관리자가 아니면 안내만', async () => {
  vi.stubGlobal('fetch', async () => Response.json({ ...admin, isAdmin: false }));
  useAuth.setState({ status: 'user', me: { ...admin, isAdmin: false } });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/admin/api-usage'] })}
    />,
  );
  expect(await screen.findByText('관리자만 볼 수 있어요')).toBeInTheDocument();
});
