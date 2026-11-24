# 트립포켓 (TripPocket)

> 브라우저에서 바로 쓰는 **오프라인 우선(Offline-first) 여행 일정 정리 웹앱(PWA)**.
> **로그인한 사람만** 쓰고(2026-10-24 결정), 한 번 로그인한 기기는 서버 없이도 전부 동작한다. 데이터는 기기에 먼저 저장되고 **홈 PC 서버**와 동기화된다.
> 구글/네이버 지도, 장소 검색·평점, 길찾기 딥링크, 다음 일정까지 이동 시간, 방문 기록, 나라별 입국 준비·긴급 연락처,
> 여행지 기상·재난 특보, 환율 계산기·AI 추천·여행 회화(빠른 메뉴)를 지원한다.

## 상태

- 운영 중: **https://trippocket.day** (Cloudflare Pages) + 홈 PC 서버 (Tailscale Funnel)
- 23단계 구현 완료 후 운영 기능 추가: 관리자 가입 승인, API 사용량·자동 중지(무료량 95%)와 대체 API, 무료 AI 순서(Gemini → Workers AI → Groq → AI 없음),
  실험실, 삭제 확인·7일 복원, 방문 기록, 여행지 특보(ADR-0008), 관리자 월간 갱신 요청문
- 2026-11: 여행 모드, 숙소 최저가(ADR-0010), 디자인 개편 "여행 노선"(ADR-0011), 사진·영수증(ADR-0012). 로그인은 카카오·Google
- 지금 상태·남은 일: [`PROGRESS.md`](PROGRESS.md) / **코드 구조: [`docs/code-map.md`](docs/code-map.md)**

## 핵심 컨셉

| 원칙                  | 의미                                                                           |
| --------------------- | ------------------------------------------------------------------------------ |
| **Login, then Local** | 로그인한 사람만 사용. 한 번 로그인한 기기는 서버 없이도 전부 동작              |
| **Secure by Default** | 비밀번호 미저장(소셜 로그인), 인바운드 포트 0개(Tailscale Funnel), 위치 미저장 |
| **Offline-first**     | 비행기 모드·해외 로밍 없이도 100% 동작 (PWA)                                   |
| **Mobile-first**      | 한 손 조작, 여행 중 빠른 조회가 최우선                                         |
| **Data Ownership**    | 언제든 JSON으로 내보내기/가져오기. 잠금 없음                                   |

## 문서 지도

- [CLAUDE.md](CLAUDE.md) — AI 협업 규칙 (매 세션 읽는 규칙)
- [PROGRESS.md](PROGRESS.md) — 지금 상태·남은 일
- [docs/README.md](docs/README.md) — **문서 전체 목록과 상태(현행·기록·보류)**
- [docs/code-map.md](docs/code-map.md) — 지금 코드 구조·자주 하는 수정 위치 (고칠 때 먼저)
- [docs/03-architecture.md](docs/03-architecture.md) — 전체 구조·스택·레이어
- [docs/adr/](docs/adr/) — 확정 결정 기록

## 개발

처음 한 번: Node.js 24 이상, `npm install -g pnpm@10` (관리자 권한 없이 사용자 폴더에 설치됨)

```bash
pnpm install          # 의존성 설치
pnpm dev              # 개발 서버 → http://localhost:5173
pnpm check            # lint + typecheck + 단위 테스트 (작업 완료 보고 전 필수)
pnpm e2e              # 브라우저 테스트 (처음 한 번: pnpm --filter @trippocket/web exec playwright install chromium)
pnpm build            # 정적 빌드 (apps/web/dist)
pnpm size             # 빌드 후 첫 화면 JS 합계(gzip) — 예산 300KB
pnpm format           # 코드 형식 정리 (커밋 시 자동 실행)
```

### 폴더

| 경로              | 내용                                                     |
| ----------------- | -------------------------------------------------------- |
| `apps/web`        | 웹앱 (React + Vite)                                      |
| `packages/shared` | 웹·서버 공용 타입·순수 함수 (React/브라우저 의존 금지)   |
| `apps/server`     | 홈 PC 서버 (Fastify + node:sqlite)                       |
| `functions`       | Cloudflare Pages Functions (홈 서버 프록시·옛 주소 이동) |
| `ops`             | 홈 PC 설치·운영 (작업 스케줄러, Funnel)                  |
