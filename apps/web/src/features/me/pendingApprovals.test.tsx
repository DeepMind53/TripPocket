import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingApprovals } from './PendingApprovals';

afterEach(() => vi.unstubAllGlobals());

it('허용·거절할 요청 팝업 (2026-11-25): 가입·참여 요청을 보여 주고, 고르면 처리 후 다시 확인 · [나중에]는 이번에만 닫기', async () => {
  const user = userEvent.setup();
  let pending = {
    joins: [
      { id: 'kakao:1', nickname: '새 사람', note: '친구예요', requestedAt: '2026-11-25T01:00:00Z' },
    ],
    trips: [
      {
        tripId: 't1',
        tripTitle: '도쿄',
        userId: 'g',
        nickname: '민수',
        role: 'viewer',
        requestedAt: '2026-11-24T01:00:00Z',
      },
    ],
  };
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (u: string, init?: RequestInit) => {
    const url = String(u);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.endsWith('/api/me/pending-approvals')) return Response.json(pending);
    if (url.includes('/api/admin/requests/kakao%3A1/approve')) {
      pending = { ...pending, joins: [] };
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  });
  const { unmount } = render(<PendingApprovals />);
  const sheet = await screen.findByRole('dialog', { name: '확인할 요청 2건' });
  expect(within(sheet).getByText('친구예요')).toBeInTheDocument();
  expect(within(sheet).getByText('도쿄 · 보기 권한')).toBeInTheDocument();
  await user.click(within(sheet).getByRole('button', { name: '승인' }));
  await waitFor(() =>
    expect(screen.getByRole('dialog', { name: '확인할 요청 1건' })).toBeInTheDocument(),
  );
  // 나중에 — 이번 실행에서만 닫힌다
  await user.click(screen.getByRole('button', { name: '나중에' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  unmount();
  // 다시 열면(다음 접속) 남은 요청이 또 뜬다
  render(<PendingApprovals />);
  expect(await screen.findByRole('dialog', { name: '확인할 요청 1건' })).toBeInTheDocument();
  expect(
    calls.filter((c) => c.endsWith('/api/me/pending-approvals')).length,
  ).toBeGreaterThanOrEqual(3);
});
