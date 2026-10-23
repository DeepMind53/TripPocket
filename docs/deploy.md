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
1. https://dash.cloudflare.com 가입/로그인 → **Workers & Pages** → **Create application** → **Pages** 탭(또는 아래 "Looking to deploy Pages? Get started") → **Import an existing Git repository** (Workers로 만들지 않기 — `functions/`는 Pages 전용)
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
- Pages 프로젝트 → Settings → **Variables and Secrets** (Production)에 추가 → 저장 후 **새 배포부터 적용** (`git commit --allow-empty` 후 push로 다시 배포):
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
- 처음 로그인한 계정 1개가 자동 가입되고 **관리자**가 된다
- 다른 사람이 로그인하면 "가입을 요청했어요" 화면 → 관리자 앱 **마이 → 사용자 관리**에 요청이 뜬다 → [승인]/[거절]
  - 승인 후 그 사람이 다시 로그인하면 바로 사용. 거절한 계정은 다시 로그인해도 거절 안내 (나중에 승인 가능)
  - [사용 중지]: 바로 로그아웃되고 다시 로그인 불가 (서버 데이터는 남김, [다시 허용] 가능)
  - 관리자가 탈퇴하면 그다음으로 오래된 계정이 관리자를 이어받는다
- `.env`의 `ALLOWED_ACCOUNTS`(예: `kakao:12345`)에 넣은 계정은 승인 없이 가입. 누구나 가입하게 하려면 `SIGNUP=open`

### 개발 중 로컬에서 시험
- `apps/server/.env`에 `WEB_ORIGIN=http://localhost:5173`, 같은 `PROXY_SECRET`
- 터미널 1: `pnpm dev:server` / 터미널 2: `TP_PROXY_SECRET=<같은값> pnpm dev` (Vite가 /api·/auth를 서버로 전달)
- 제공자 콜백 주소에 `http://localhost:5173/auth/<제공자>/callback`도 추가

## 6. 환율 인증키 (19단계, 사용자 작업 — 무료, 선택)
- 한국수출입은행 https://www.koreaexim.go.kr → 오픈API → 현재환율 → 인증키 발급 신청 → `apps/server/.env`의 `EXIM_API_KEY`
- 키가 없거나 홈 PC가 꺼져 있어도 앱은 무료 국제 시세(currency-api, 하루 1회)로 계산하고, 화면에 "국제 시세(참고용)"로 표시한다

## 7. AI 추천 수집 키 (20단계, 사용자 작업 — 무료)
- 네이버: 5절에서 만든 애플리케이션 → API 설정 → 사용 API에 **검색** 추가 (같은 Client ID·Secret 사용). 따로 만들면 `.env`의 `NAVER_SEARCH_ID`·`NAVER_SEARCH_SECRET`
- 카카오: 5절 앱의 REST API 키를 그대로 사용 (가까운 역 찾기, 국내). 해외는 OpenStreetMap(키 없음)
- 확인: 로그인 → 마이 → AI 추천 수집(개발용) (개발 빌드에서만 메뉴 표시, 주소 `/dev/ai`)

## 8. 지도 키 (17단계, 사용자 작업 — 무료 한도 안에서)
결정: Google 지도(무료 한도) + 국내는 네이버 지도 (docs/08 L5). 키는 **브라우저용**이라 웹앱에 들어가므로 **반드시 도메인 제한**.

### Google Maps JavaScript API
1. https://console.cloud.google.com → 18단계와 같은 프로젝트 → 결제 계정 연결 (카드 등록 필요, 무료 한도 안에서는 0원)
2. API 및 서비스 → 라이브러리 → **Maps JavaScript API** 사용 설정
3. 사용자 인증 정보 → API 키 만들기 → 키 제한:
   - 애플리케이션 제한: **웹사이트** → `https://trippocket.pages.dev/*` (개발 중이면 `http://localhost:5173/*`도)
   - API 제한: **Maps JavaScript API만**
4. **과금 차단**: API 및 서비스 → Maps JavaScript API → 할당량 → "Map loads per day"를 **300** 정도로 (월 무료 1만 회 ≈ 하루 330회)
5. 결제 → 예산 및 알림 → 월 1,000원 예산 + 50% 알림
6. Cloudflare Pages → 환경 변수(빌드) `VITE_GOOGLE_MAPS_KEY` = 키 → 다시 배포

### 네이버 지도 (국내 여행, 선택)
1. https://console.ncloud.com → Services → **Maps** → Application 등록 → Web Dynamic Map 선택
2. Web 서비스 URL: `https://trippocket.pages.dev` (개발: `http://localhost:5173`)
3. **요금 확인**: Maps 요금 안내에서 Web Dynamic Map 무료 이용량 확인 (2025년 정책 변경 — 무료 범위를 넘으면 과금되니 사용량 알림 설정)
4. Client ID → Pages 환경 변수 `VITE_NAVER_MAP_CLIENT_ID` → 다시 배포
- 네이버 키가 없으면 국내 여행도 Google 지도로 보여 준다. 설정 → 지도·길찾기 → 앱 안 지도에서 바꿀 수 있다

- 지도는 일정 화면의 [지도] 버튼을 눌렀을 때만 불러온다 (무료 사용량 아끼기). 오프라인이면 안내만 보인다

## 9. 장소 검색 키 (18단계, 사용자 작업)
- **카카오·네이버(국내, 무료)**: 5절 앱 그대로 — 카카오 REST 키(로컬 API 자동 포함), 네이버 앱에 '검색' API 추가(7절과 같음)
- **Google Places (해외·평점·영업시간, 무료 한도 안)**:
  1. 8절 프로젝트에서 **Places API (New)** 사용 설정
  2. API 키를 **새로** 만들기(서버용): 애플리케이션 제한 없음 또는 IP, **API 제한 = Places API (New)만**
  3. 할당량: "Text Search requests per day" 150, "Place Details requests per day" 30 (월 무료 5천·1천 안)
  4. `apps/server/.env`의 `GOOGLE_PLACES_KEY` (브라우저용 지도 키와 다른 키 — 웹앱에 넣지 않음)
- 서버도 하루 상한(`GOOGLE_SEARCH_DAILY`, `GOOGLE_DETAILS_DAILY`)과 사람별 한도를 지켜 무료 범위를 넘지 않게 한다
- 평점·리뷰 수·영업시간은 저장하지 않고 볼 때마다 받는다 (Google 약관)

## 10. AI 추천 키 (21단계, 사용자 작업)
- https://console.groq.com/keys → API 키 만들기 → `apps/server/.env`의 `GROQ_API_KEY`
- 모델 기본값 `openai/gpt-oss-120b` (바꾸려면 `GROQ_MODEL`). 무료 등급도 하루 약 1,000회 — 앱은 사람마다 하루 20회로 제한
- AI에는 기준점 이름과 네이버 블로그 공개 글의 제목·요약만 보낸다 (좌표·이름·일정 없음)
