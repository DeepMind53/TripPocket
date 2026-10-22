# ADR-0006: 무료 주소 + Cloudflare Pages 프록시로 홈 서버 연결

- 상태: 확정
- 날짜: 2026-10-23

## 배경 (Context)
- 도메인 구매 없이 무료로 운영하기로 했다 (docs/08 L2): 웹앱은 `*.pages.dev`, 홈 서버는 Tailscale Funnel `*.ts.net`.
- 두 주소는 **서로 다른 사이트**다. docs/09 §4.2의 세션 쿠키(`__Host-sid; SameSite=Lax`)는 다른 사이트로 보내는 fetch에 실리지 않고,
  아이폰 사파리는 제3자 쿠키를 아예 막는다 → 웹앱이 서버 API를 직접 부르면 로그인이 유지되지 않는다.
- ADR-0003·docs/09는 "웹앱·API를 같은 사이트(서브도메인)"로 두는 것을 전제로 했는데, 이는 내 도메인이 있어야 가능했다.

## 결정 (Decision)
- 웹앱 주소의 `/api/*`, `/auth/*` 요청을 **Cloudflare Pages Functions**(`functions/`)가 홈 서버로 그대로 전달한다.
  브라우저 입장에서는 모든 요청이 같은 주소 → 쿠키·CSP(`connect-src 'self'`)·OAuth 리다이렉트가 단순해진다.
- 프록시는 비밀 헤더 `x-tp-proxy`(Pages 환경 변수 `TP_PROXY_SECRET`)를 붙이고, 홈 서버는 이 값이 맞는 요청만 받는다
  (`/healthz` 제외, 틀리면 404). 터널 주소가 알려져도 직접 호출은 막힌다. 비교는 시간 일정(timingSafeEqual).
- 서버는 계속 `127.0.0.1`에만 열고, 밖에서는 Tailscale Funnel로만 들어온다 (docs/09 §7.1).
- 상태를 바꾸는 요청은 `Origin == WEB_ORIGIN` 검사 (CSRF). 실제 접속 IP는 `cf-connecting-ip`만 믿는다.

## 검토한 대안
| 대안 | 장점 | 단점 |
|---|---|---|
| 내 도메인(app./api. 서브도메인) | 원래 설계 그대로 | 유료(연 1~2만 원) — 사용자가 무료 선택 |
| 서버가 웹앱도 함께 제공(같은 ts.net 주소) | 프록시 불필요 | PC가 꺼지면 앱 첫 접속 불가, CDN 없음, 앱 주소가 PC에 묶임 |
| 쿠키 대신 토큰(Authorization 헤더, IndexedDB 보관) | 크로스 사이트 가능 | XSS 시 토큰 탈취 위험, 즉시 폐기·HttpOnly 이점 상실 |
| ngrok 고정 주소 | 익숙함 | 무료 고정 주소 1개는 다른 프로젝트가 사용 중 |

## 결과 (Consequences)
- 좋아지는 점: 무료, 쿠키 세션 설계 유지, 서버 주소가 앱 코드·CSP에 드러나지 않음, 서버 주소 변경 시 Pages 환경 변수만 수정
- 감수하는 점: Pages Functions 무료 한도(하루 10만 요청) — 개인·가족 사용에 충분. 요청이 Cloudflare를 한 번 더 거침
- 후속 작업: 14단계 OAuth 콜백 주소 = `https://<앱주소>/auth/{provider}/callback`, 16단계 Funnel 설정·Pages 환경 변수 등록 (docs/deploy.md)
