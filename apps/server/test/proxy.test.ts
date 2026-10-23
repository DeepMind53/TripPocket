import { proxy } from '../../../functions/_proxy';

const env = { TP_SERVER_URL: 'https://pc.example.ts.net', TP_PROXY_SECRET: 'p'.repeat(40) };

describe('Cloudflare Pages 프록시 (ADR-0006)', () => {
  it('같은 경로로 서버에 넘기고 비밀 헤더를 붙인다 — 브라우저가 보낸 비밀 헤더는 버린다', async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) =>
        new Response('{"ok":1}', { status: 302, headers: { location: '/x', 'set-cookie': 'a=1' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await proxy(
      new Request('https://trippocket.pages.dev/auth/kakao/start?x=1', {
        headers: {
          'x-tp-proxy': 'fake',
          'x-tp-origin': 'https://evil.example',
          cookie: 'sid=1',
          'cf-connecting-ip': '1.2.3.4',
        },
      }),
      env,
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://pc.example.ts.net/auth/kakao/start?x=1');
    const h = new Headers(init.headers);
    expect(h.get('x-tp-proxy')).toBe(env.TP_PROXY_SECRET);
    expect(h.get('cookie')).toBe('sid=1');
    // 들어온 주소는 프록시가 정한다 (브라우저가 보낸 값은 버림)
    expect(h.get('x-tp-origin')).toBe('https://trippocket.pages.dev');
    expect(h.get('x-forwarded-for')).toBe('1.2.3.4');
    expect(init.redirect).toBe('manual');
    // 리다이렉트·쿠키는 그대로 브라우저로
    expect(res.status).toBe(302);
    expect(res.headers.get('set-cookie')).toBe('a=1');
    vi.unstubAllGlobals();
  });

  it('서버 설정 전이면 503, 홈 PC가 꺼져 있으면 502', async () => {
    expect((await proxy(new Request('https://a.dev/api/me'), {})).status).toBe(503);
    vi.stubGlobal('fetch', () => Promise.reject(new Error('down')));
    expect((await proxy(new Request('https://a.dev/api/me'), env)).status).toBe(502);
    vi.unstubAllGlobals();
  });
});
