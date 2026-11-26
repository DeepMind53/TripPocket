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
// 앱 화면 저장 키: Cloudflare Pages는 /index.html 을 / 로 308 이동시키므로 / 를 저장한다
const SHELL_HTML = '/';
// 서버로 가야 하는 경로 — 로그인(OAuth 이동·콜백)과 API는 저장본으로 가로채지 않는다
const PASS_THROUGH = /^\/(auth|api)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(brokenOldShell)
      .then((broken) => broken && self.skipWaiting()),
  );
});

/** 예전 버전이 이동(redirect)된 응답을 저장해 화면이 안 열리면 [업데이트]를 누를 수도 없다 → 바로 교체 */
async function brokenOldShell() {
  for (const key of await caches.keys()) {
    if (key === SHELL || !key.startsWith('tp-shell-')) continue;
    const old = await (await caches.open(key)).match('/index.html', MATCH);
    if (old && old.redirected) return true;
  }
  return false;
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          // 새 버전: 예전 앱 파일·지난 파일 저장본을 지운다 (글꼴은 쓸 때 다시 저장)
          // 회화 음성(tp-phrases, 여행지 말만 미리 받은 것)은 남긴다 — 파일 이름에 문장 해시가 있어 바뀌지 않는다
          keys.filter((k) => k !== SHELL && k !== 'tp-phrases').map((k) => caches.delete(k)),
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
  if (PASS_THROUGH.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      caches
        .match(SHELL_HTML, MATCH)
        // 이동된 응답은 화면 이동에 쓸 수 없다 (브라우저가 "연결할 수 없음") → 네트워크로
        .then((hit) => (hit && !hit.redirected ? hit : fetch(req))),
    );
    return;
  }
  // 회화 음성 (2026-11-26): 소리는 "몇 바이트부터"(Range)로 나눠 달라고 한다 — 아이폰 사파리는 206 조각이 아니면 틀지 않는다.
  // 받아 둔 저장본(tp-phrases, 앱의 [받기]가 채움)에서 요청한 조각만 잘라 준다
  if (url.pathname.startsWith('/phrases/')) {
    event.respondWith(phraseAudio(req, url));
    return;
  }
  // 파일: 저장본 먼저, 없으면 받아서 저장 (이름에 해시가 있어 바뀌지 않음)
  event.respondWith(
    caches.match(req, MATCH).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          // 206(조각) 응답은 저장할 수 없다
          if (res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            void caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

/** 회화 음성: 받아 둔 저장본 → Range 요청이면 그 조각만 206으로. 없으면 서버에서 */
async function phraseAudio(req, url) {
  // 중국어 학습 앱 sw.js와 같게: 받아 둔 소리면 저장본(조각 요청은 206), 아직 안 받은 소리·받기 목록은 서버에서 바로
  if (!url.pathname.endsWith('.mp3')) return fetch(req);
  const res = await (await caches.open('tp-phrases')).match(url.pathname);
  if (!res) return fetch(req);
  const range = req.headers.get('range');
  if (!range) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = 0;
  let end = size - 1;
  if (m && m[1]) {
    start = Number(m[1]);
    if (m[2]) end = Math.min(Number(m[2]), size - 1);
  } else if (m && m[2]) {
    start = Math.max(0, size - Number(m[2]));
  }
  if (start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

// 알림 (docs/20 G1): 서버가 보낸 웹 푸시 → 알림 표시, 누르면 그 화면
self.addEventListener('push', (event) => {
  let msg = { title: '트립포켓', body: '', url: '/' };
  try {
    msg = { ...msg, ...event.data.json() };
  } catch {
    // 형식이 틀리면 기본 문구
  }
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: msg.url },
      tag: msg.url,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((c) => (c || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
