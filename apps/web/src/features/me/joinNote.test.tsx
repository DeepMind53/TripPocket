import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { LoginPage } from './LoginPage';

/** 가입 대기 화면: 닉네임·관리자에게 전할 말 (사용자 요청 2026-11-03) */
it('대기 중이면 #join 토큰으로 관리자에게 전할 말을 보내고, 토큰은 주소에서 지운다', async () => {
  const sent: { url: string; body: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    sent.push({ url: String(url), body: String(init?.body ?? '') });
    if (String(url).includes('/auth/providers')) return Response.json({ providers: ['kakao'] });
    return Response.json({ ok: true });
  });
  window.history.replaceState(null, '', '/login?error=pending#join=abcdefghijklmnop');
  try {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login?error=pending']}>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(window.location.hash).toBe('');
    expect(screen.getByText(/따로 저장하지 않고 승인·거절하면 바로 지워요/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /닉네임/ }), '김여행');
    await user.type(screen.getByRole('textbox', { name: '관리자에게 전할 말' }), '회사 동료예요');
    await user.click(screen.getByRole('button', { name: '관리자에게 보내기' }));
    const post = sent.find((s) => s.url === '/auth/join-note')!;
    expect(JSON.parse(post.body)).toEqual({
      token: 'abcdefghijklmnop',
      note: '회사 동료예요',
      nickname: '김여행',
    });
    expect((await screen.findAllByText(/관리자에게 전했어요/)).length).toBeGreaterThan(0);
  } finally {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  }
});
