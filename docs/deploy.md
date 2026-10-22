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

## 3. 휴대폰 실기기 확인 (12단계 확인 방법)
1. 휴대폰 브라우저(아이폰 Safari / 안드로이드 Chrome)로 `https://trippocket.pages.dev` 접속
   - 카톡에서 링크를 누르면 앱 안 브라우저로 열린다 → 위쪽 안내 띠의 [다른 브라우저로 열기]
2. 마이 → **홈 화면에 앱 설치** 안내대로 홈 화면에 추가
3. 여행을 하나 만든 뒤 **비행기 모드** → 홈 화면 아이콘으로 열기 → 여행이 보이면 성공
4. 마이 → 백업·복원 → 저장공간 "보호됨" 확인 (안 되면 [저장공간 보호 요청])

## 4. 나중에 내 도메인으로 바꾸려면
- Cloudflare Pages → Custom domains에서 연결만 하면 되지만, **주소가 바뀌면 기기 데이터가 따로**다.
  바꾸기 전에 모든 기기에서 백업 파일을 만들고, 새 주소에서 복원한다 (로그인·동기화(15단계) 이후라면 서버에서 자동으로 받음).
