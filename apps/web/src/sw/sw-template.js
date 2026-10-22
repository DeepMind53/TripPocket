/* 트립포켓 서비스 워커 — 빌드 때 vite.config.ts의 serviceWorker 플러그인이 아래 두 값을 채워 dist/sw.js로 낸다.
 * - 앱 화면(HTML·JS·CSS·아이콘)은 설치 때 미리 저장 → 비행기 모드에서도 열림
 * - 글꼴 등 나머지 같은 사이트 파일은 처음 쓸 때 저장
 * - 새 버전은 사용자가 [업데이트]를 누를 때 적용 (작성 중인 내용이 갑자기 날아가지 않게)
 * - 외부 서비스(공휴일·날씨 등)는 건드리지 않음 — 앱이 IndexedDB에 따로 저장 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = `tp-shell-${VERSION}`;
const RUNTIME = 'tp-runtime';
// 서버가 Vary: Origin 을 붙이면 모듈 스크립트 요청(Origin 헤더 있음)이 저장본과 안 맞는다 → Vary 무시
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          // 새 버전: 예전 앱 파일·지난 파일 저장본을 지운다 (글꼴은 쓸 때 다시 저장)
          keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 화면 이동: 저장된 앱 화면 (주소가 달라도 같은 index.html — 앱 안 라우터가 처리)
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('/index.html', MATCH).then((hit) => hit || fetch(req)));
    return;
  }
  // 파일: 저장본 먼저, 없으면 받아서 저장 (이름에 해시가 있어 바뀌지 않음)
  event.respondWith(
    caches.match(req, MATCH).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            void caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
