/**
 * 옛 주소(trippocket.pages.dev) → 새 주소(trippocket.day) 이동 (2026-10-24, docs/deploy.md 4절).
 * 화면 이동(HTML)만 옮긴다:
 * - sw.js·앱 파일은 그대로 → 이미 설치된 앱도 새 버전을 받아 "주소가 바뀌었어요" 안내를 띄울 수 있다
 * - /api·/auth 는 그대로 → 진행 중인 로그인·동기화가 끊기지 않는다 (서버는 두 주소 모두 허용)
 * 미리보기 배포(<해시>.trippocket.pages.dev)는 옮기지 않는다
 */
export const OLD_HOST = 'trippocket.pages.dev';
export const NEW_ORIGIN = 'https://trippocket.day';

export function moveToNewOrigin(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname !== OLD_HOST || request.method !== 'GET') return null;
  if (/^\/(api|auth)\//.test(url.pathname)) return null;
  const isPage =
    request.headers.get('sec-fetch-mode') === 'navigate' ||
    (request.headers.get('accept') ?? '').includes('text/html');
  if (!isPage) return null;
  return Response.redirect(`${NEW_ORIGIN}${url.pathname}${url.search}`, 301);
}

export const onRequest = (ctx: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> | Response => moveToNewOrigin(ctx.request) ?? ctx.next();
