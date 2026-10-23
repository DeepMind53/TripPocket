/**
 * Cloudflare Pages Functions — 웹앱과 같은 주소(trippocket.day·pages.dev)의 /api/*, /auth/* 를 홈 서버로 전달 (ADR-0006).
 * - 브라우저는 한 주소만 보므로 로그인 쿠키(__Host-sid, SameSite=Lax)가 그대로 동작 (사파리 제3자 쿠키 차단 영향 없음)
 * - 홈 서버는 비밀 헤더가 있는 요청만 받는다 → 터널 주소로 직접 오는 요청은 거부
 * 환경 변수 (Pages 설정): TP_SERVER_URL (예: https://pc.tailnet.ts.net), TP_PROXY_SECRET
 */
export interface ProxyEnv {
  TP_SERVER_URL?: string;
  TP_PROXY_SECRET?: string;
}

const PROXY_HEADER = 'x-tp-proxy';
/** 사용자가 들어온 웹앱 주소 (주소를 옮기는 동안 여러 개 — 서버가 허용 목록과 대조해 로그인 콜백에 씀) */
const ORIGIN_HEADER = 'x-tp-origin';
/** 브라우저가 보낸 것 중 서버로 넘기지 않는 헤더 */
const DROP = [
  'host',
  PROXY_HEADER,
  ORIGIN_HEADER,
  'cf-connecting-ip',
  'x-forwarded-for',
  'x-real-ip',
];

export async function proxy(request: Request, env: ProxyEnv): Promise<Response> {
  if (!env.TP_SERVER_URL || !env.TP_PROXY_SECRET) {
    // 서버를 아직 연결하지 않았으면 앱은 로컬 모드로 동작 (로그인 버튼만 실패)
    return Response.json({ error: 'server_not_configured' }, { status: 503 });
  }
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.TP_SERVER_URL);

  const headers = new Headers(request.headers);
  for (const h of DROP) headers.delete(h);
  headers.set(PROXY_HEADER, env.TP_PROXY_SECRET);
  headers.set(ORIGIN_HEADER, url.origin);
  // 실제 접속 IP (요청 제한용) — Cloudflare가 알려 준 값만 믿는다
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers.set('x-forwarded-for', ip);

  const init: RequestInit = { method: request.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.arrayBuffer();

  try {
    const res = await fetch(target, init);
    // OAuth 리다이렉트·Set-Cookie 그대로 전달
    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch {
    // 홈 PC가 꺼져 있음 → 앱은 "동기화 대기 중"으로 보여 준다
    return Response.json({ error: 'server_unreachable' }, { status: 502 });
  }
}

export const onRequest = (ctx: { request: Request; env: ProxyEnv }): Promise<Response> =>
  proxy(ctx.request, ctx.env);
