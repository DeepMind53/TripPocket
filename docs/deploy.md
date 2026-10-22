# 배포 안내 (12단계) — 무료 구성

결정 (2026-10-23, docs/08 L2): **도메인 구매 없이 무료 주소**
- 웹앱: Cloudflare Pages → `https://<프로젝트이름>.pages.dev` (무료, HTTPS, 전 세계 CDN)
- 홈 서버(13단계~): Tailscale Funnel → `https://<컴퓨터이름>.<tailnet>.ts.net` (무료, 고정 주소)
  - ngrok 무료 고정 주소는 계정당 1개 — 이미 `D:\Study_Taiwan_Chinese`가 사용 중

> ⚠️ **웹앱 주소는 한 번 정하면 바꾸지 않는다.** 데이터(IndexedDB)는 주소(origin)별로 저장되므로
> 주소가 바뀌면 이전 주소에 저장한 여행이 새 주소에서 안 보인다 (백업 파일로 옮겨야 함). docs/06 §2

## 1. GitHub 저장소 (한 번만, 사용자 작업)
1. https://github.com/new → 이름 `trippocket`, **Private**(비공개, docs/08 E1) → README 등 추가 없이 만들기
2. 이 컴퓨터에서 (첫 push 때 GitHub 로그인 창이 뜸):
   ```
   cd D:\Travel_Planner
   git remote add origin https://github.com/<내아이디>/trippocket.git
   git push -u origin main
   ```
3. 저장소 → Actions 탭에서 CI(검사·빌드·E2E)가 초록색인지 확인

## 2. Cloudflare Pages (한 번만, 사용자 작업)
1. https://dash.cloudflare.com 가입/로그인 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. GitHub 연결 → `trippocket` 저장소 선택
3. 빌드 설정
   | 항목 | 값 |
   |---|---|
   | Project name | `trippocket` (→ `trippocket.pages.dev`, 이미 있으면 다른 이름 — **이 이름이 앱 주소**) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npx pnpm@10.34.7 install --frozen-lockfile && npx pnpm@10.34.7 --filter @trippocket/web build` |
   | Build output directory | `apps/web/dist` |
   | Environment variables | `NODE_VERSION` = `24` |
4. **Save and Deploy** → 1~3분 뒤 주소가 나온다. 이후 `main`에 push할 때마다 자동 배포
5. 보안 헤더·캐시는 `apps/web/public/_headers`가 자동 적용 (따로 설정 없음)

## 2-1. 홈 서버 연결 (16단계 때, 사용자 작업)
- Pages → Settings → Environment variables (Production)에 추가:
  | 이름 | 값 |
  |---|---|
  | `TP_SERVER_URL` | 홈 서버 Funnel 주소 (예: `https://내컴퓨터.tailnet이름.ts.net`) |
  | `TP_PROXY_SECRET` | `apps/server/.env`의 `PROXY_SECRET`과 같은 값 (Encrypt 체크) |
- 웹앱의 `/api/*`, `/auth/*`가 이 서버로 전달된다 (`functions/`, ADR-0006). 값이 없으면 로컬 모드로만 동작

## 3. 휴대폰 실기기 확인 (12단계 확인 방법)
1. 휴대폰 브라우저(아이폰 Safari / 안드로이드 Chrome)로 `https://trippocket.pages.dev` 접속
   - 카톡에서 링크를 누르면 앱 안 브라우저로 열린다 → 위쪽 안내 띠의 [다른 브라우저로 열기]
2. 마이 → **홈 화면에 앱 설치** 안내대로 홈 화면에 추가
3. 여행을 하나 만든 뒤 **비행기 모드** → 홈 화면 아이콘으로 열기 → 여행이 보이면 성공
4. 마이 → 백업·복원 → 저장공간 "보호됨" 확인 (안 되면 [저장공간 보호 요청])

## 4. 나중에 내 도메인으로 바꾸려면
- Cloudflare Pages → Custom domains에서 연결만 하면 되지만, **주소가 바뀌면 기기 데이터가 따로**다.
  바꾸기 전에 모든 기기에서 백업 파일을 만들고, 새 주소에서 복원한다 (로그인·동기화(15단계) 이후라면 서버에서 자동으로 받음).

## 5. 소셜 로그인 앱 등록 (14단계, 사용자 작업 — 모두 무료)
콜백 주소는 모두 **웹앱 주소** 기준이다 (Pages 프록시가 홈 서버로 전달, ADR-0006). 아래 `<앱주소>` = `https://trippocket.pages.dev`.
받은 아이디·시크릿은 **홈 PC의 `apps/server/.env`에만** 넣는다 (저장소·웹앱에 넣지 않음).

### 카카오 (https://developers.kakao.com)
1. 내 애플리케이션 → 애플리케이션 추가 → 앱 이름 `트립포켓`
2. 앱 키의 **REST API 키** → `.env`의 `KAKAO_CLIENT_ID`
3. 카카오 로그인 → 활성화 ON, **Redirect URI**: `<앱주소>/auth/kakao/callback`
4. 카카오 로그인 → 보안 → **Client Secret** 생성·사용함 → `KAKAO_CLIENT_SECRET`
5. 동의항목 → **닉네임**만 "필수 동의" (그 밖은 받지 않음)
6. 플랫폼 → Web → 사이트 도메인 `<앱주소>`

### 네이버 (https://developers.naver.com/apps)
1. Application 등록 → 사용 API **네이버 로그인** → 제공 정보 **별명(닉네임)** 만 필수
2. 환경: PC 웹 → 서비스 URL `<앱주소>`, Callback URL `<앱주소>/auth/naver/callback`
3. Client ID → `NAVER_CLIENT_ID`, Client Secret → `NAVER_CLIENT_SECRET`
4. 처음에는 "개발 중" 상태 — 멤버관리에 등록한 아이디(최대 20명)만 로그인 가능. 가족·지인만 쓰면 그대로 두어도 됨 (공개하려면 검수 요청)

### Google (https://console.cloud.google.com)
1. 새 프로젝트 → API 및 서비스 → **OAuth 동의 화면**: 외부, 앱 이름 `트립포켓`, 범위는 기본(openid·profile)만 — 민감 범위가 없어 심사 불필요
2. 테스트 사용자에 로그인할 Google 계정 추가 (게시 전 100명까지)
3. 사용자 인증 정보 → OAuth 클라이언트 ID → 웹 애플리케이션
   - 승인된 리디렉션 URI: `<앱주소>/auth/google/callback`
4. 클라이언트 ID → `GOOGLE_CLIENT_ID`, 보안 비밀 → `GOOGLE_CLIENT_SECRET`
   (결제 정보 등록 필요 없음)

### 가입 정책 (docs/08 G1, 기본 초대제)
- 처음 로그인한 계정 1개만 자동 가입. 다른 사람은 로그인하면 "초대받지 않은 계정" 화면에 `kakao:12345` 같은 값이 나온다
  → 그 값을 `.env`의 `ALLOWED_ACCOUNTS`에 쉼표로 추가하고 서버 재시작. 누구나 가입하게 하려면 `SIGNUP=open`

### 개발 중 로컬에서 시험
- `apps/server/.env`에 `WEB_ORIGIN=http://localhost:5173`, 같은 `PROXY_SECRET`
- 터미널 1: `pnpm dev:server` / 터미널 2: `TP_PROXY_SECRET=<같은값> pnpm dev` (Vite가 /api·/auth를 서버로 전달)
- 제공자 콜백 주소에 `http://localhost:5173/auth/<제공자>/callback`도 추가

## 6. 환율 인증키 (19단계, 사용자 작업 — 무료, 선택)
- 한국수출입은행 https://www.koreaexim.go.kr → 오픈API → 현재환율 → 인증키 발급 신청 → `apps/server/.env`의 `EXIM_API_KEY`
- 키가 없거나 홈 PC가 꺼져 있어도 앱은 무료 국제 시세(currency-api, 하루 1회)로 계산하고, 화면에 "국제 시세(참고용)"로 표시한다
