import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { useAuth } from '../../data/authStore';
import { resetLocalDb, seedSampleTrip } from '../../data/dev';
import { Toaster } from '../../shared/ui';

const renderAt = (path: string) =>
  render(
    <>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
      <Toaster />
    </>,
  );

let copied: string[];
beforeEach(async () => {
  await resetLocalDb();
  copied = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ status: 'unknown', me: null });
});

async function openShare() {
  const tripId = await seedSampleTrip();
  const user = userEvent.setup();
  // userEvent가 클립보드를 바꿔 끼우므로 그 뒤에 흉내 낸다
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (s: string) => void copied.push(s) },
  });
  renderAt(`/trips/${tripId}/plan`);
  await user.click(await screen.findByRole('button', { name: '더보기' }));
  await user.click(await screen.findByRole('button', { name: '공유·내보내기' }));
  return { user, tripId, sheet: await screen.findByRole('dialog', { name: '공유·내보내기' }) };
}

describe('공유', () => {
  it('서버에 닿지 않을 때(로그인했던 기기): 텍스트로 복사(예약번호 없이), 링크는 연결 안 됨 안내', async () => {
    useAuth.setState({ status: 'offline', me: null });
    const { user, sheet } = await openShare();
    await user.click(within(sheet).getByRole('button', { name: '텍스트 복사' }));
    // 복사는 기기 DB를 읽은 뒤라 비동기 — 끝날 때까지 기다린다
    await waitFor(() => expect(copied[0]).toMatch(/^🗼 도쿄 가을여행\n/));
    expect(copied[0]).toContain('[1일차');
    expect(within(sheet).getByText(/서버에 연결할 수 없어 링크/)).toBeInTheDocument();
  });

  it('로그인: 보기 전용 링크를 만들면 주소가 복사되고, 소유자는 초대 링크를 만든다', async () => {
    useAuth.setState({
      status: 'user',
      me: { id: 'u1', nickname: '나', createdAt: '', providers: [] },
    });
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url} ${String(init?.body ?? '')}`);
      if (url.endsWith('/share') && init?.method === 'POST')
        return Response.json({ share: { id: 'abc123def456ghi789jk', includeSensitive: false } });
      if (url.endsWith('/share')) return Response.json({ share: null });
      if (url.endsWith('/members'))
        return Response.json({
          members: [{ userId: 'u1', nickname: '나', role: 'owner', me: true }],
        });
      if (url.endsWith('/invites')) return Response.json({ token: 'TOKEN', expiresAt: '' });
      return Response.json({}, { status: 404 });
    });
    const { user, sheet } = await openShare();
    await user.click(within(sheet).getByRole('button', { name: '링크 만들고 복사' }));
    expect(
      await within(sheet).findByText(/예약번호·연락처·메모는 보이지 않아요/),
    ).toBeInTheDocument();
    expect(copied).toContain(`${window.location.origin}/s/abc123def456ghi789jk`);
    expect(calls.some((c) => c.includes('POST') && c.includes('"includeSensitive":false'))).toBe(
      true,
    );

    await user.click(within(sheet).getByRole('radio', { name: '보기' }));
    await user.click(within(sheet).getByRole('button', { name: '초대 링크 만들고 복사' }));
    expect(copied).toContain(`${window.location.origin}/invite/TOKEN`);
    expect(calls.some((c) => c.includes('/invites') && c.includes('"role":"viewer"'))).toBe(true);
  });

  it('보기 전용 일정: 로그인 없이, 꺼진 링크는 안내', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url.endsWith('/ok')
        ? Response.json({
            trip: {
              id: 't',
              title: '오사카',
              destinations: [],
              startDate: '2026-11-01',
              endDate: '2026-11-01',
              timezone: 'Asia/Tokyo',
              cover: { emoji: '🏯' },
              createdAt: '',
              updatedAt: '',
            },
            items: [
              {
                id: 'i',
                tripId: 't',
                date: '2026-11-01',
                order: 'a',
                kind: 'place',
                title: '오사카성',
                startTime: '10:00',
                createdAt: '',
                updatedAt: '',
              },
            ],
            bookings: [],
            includeSensitive: false,
          })
        : Response.json({ error: 'not_found' }, { status: 404 }),
    );
    renderAt('/s/ok');
    expect(await screen.findByRole('heading', { name: /오사카/ })).toBeInTheDocument();
    expect(screen.getByText('오사카성')).toBeInTheDocument();
  });
});

describe('초대 승인제', () => {
  const asUser = () =>
    useAuth.setState({
      status: 'user',
      me: { id: 'u1', nickname: '나', createdAt: '', providers: [] },
    });

  it('초대 링크를 열면 바로 들어가지 않고 "참여를 요청했어요"', async () => {
    asUser();
    vi.stubGlobal('fetch', async (url: string) =>
      url.includes('/accept')
        ? Response.json({ tripId: 't1', status: 'pending', role: 'editor' })
        : Response.json({}, { status: 404 }),
    );
    renderAt('/invite/TOKEN');
    expect(await screen.findByRole('heading', { name: '참여를 요청했어요' })).toBeInTheDocument();
  });

  it('소유자는 공유 시트에서 요청을 보고 허용한다 → 멤버 목록에 추가', async () => {
    asUser();
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url} ${String(init?.body ?? '')}`);
      if (url.endsWith('/share')) return Response.json({ share: null });
      if (url.endsWith('/members'))
        return Response.json({
          members: [{ userId: 'u1', nickname: '나', role: 'owner', me: true }],
          requests: [{ userId: 'u2', nickname: '친구', role: 'editor', requestedAt: '' }],
        });
      if (url.includes('/requests/u2/approve')) return Response.json({ ok: true, role: 'editor' });
      return Response.json({}, { status: 404 });
    });
    const { user, sheet } = await openShare();
    const box = await within(sheet).findByRole('region', { name: '참여 요청' });
    expect(box).toHaveTextContent('친구');
    await user.click(within(box).getByRole('button', { name: '허용' }));
    expect(await screen.findByText('친구 님을 허용했어요')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('POST') && c.includes('/requests/u2/approve'))).toBe(
      true,
    );
    expect(within(sheet).queryByRole('region', { name: '참여 요청' })).not.toBeInTheDocument();
    expect(within(sheet).getByText('친구')).toBeInTheDocument();
  });
});
