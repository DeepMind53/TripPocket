# 03. 아키텍처

- 문서 상태: **운영 중인 구조 기준** (2026-11-02 갱신). §1·§2·§5·§7~§9는 실제 구조, §4·§6은 처음 설계안이라 폴더·라우트는 [`code-map.md`](code-map.md)가 기준이다

## 1. 전체 구조

```
휴대폰·PC 브라우저 (PWA)
  UI (React) ─ features ─ data/repositories ─▶ IndexedDB (1차 저장, 오프라인 동작)
  동기화 엔진 ─ 고친 행 올리기 / 바뀐 행 받기 (시작·복귀·고친 뒤·30초마다)
  서비스 워커 (직접 작성, 앱 파일 미리 저장)
  지도 SDK ─ 지도를 열 때만 불러옴
    해외: Google / 국내: 설정값(네이버·카카오·매번 묻기) / 멈추면: MapLibre + OpenFreeMap
  길찾기 ─ 지도 앱 딥링크
       │ 같은 주소 https://trippocket.day (쿠키 세션)
       ▼
Cloudflare Pages ─ 웹앱 + Functions가 /api·/auth를 전달 (비밀 헤더, ADR-0006)
       │ Tailscale Funnel
       ▼
홈 PC: Node.js + Fastify (127.0.0.1, 비밀 헤더 없으면 404)
  인증·동기화·공유·후기·알림 ─ SQLite(node:sqlite) + 첨부 파일 + 암호화 백업(매일 03:00)
  외부 API는 services/apiUsage.ts로 사용량 측정·자동 중지 (무료량 95%)
    장소: 국내 네이버 → 카카오 / 해외 Google → 자동완성 → Geoapify
    AI 추천: Gemini → Workers AI → Groq → AI 없이 / 환율: 수출입은행
    특보: GDACS·USGS·외교부·나라별 기상청 / 항공편: AviationStack / 길 시간: Google Routes·Geoapify
```

- 로그인한 사람만 앱을 쓴다 (`app/AuthGate.tsx`). 이 기기에서 로그인한 적 있으면 서버 없이도 동작한다
- 사용자 위치는 저장·기록하지 않는다. 사용자 데이터는 홈 서버로만 보낸다

## 2. 기술 스택 (실제)

| 영역 | 사용 | 메모 |
|---|---|---|
| 언어·빌드 | TypeScript strict, Vite, pnpm workspaces | ADR-0005 |
| UI | React 19, React Router, Tailwind CSS 4, Radix(필요한 것만), lucide-react, dnd-kit(편집 때만) | 시트 등은 처음 열 때 불러옴 |
| 로컬 DB·상태 | Dexie(IndexedDB), Zustand | UI는 항상 로컬 DB에서 읽는다 |
| 검증 | `zod/mini` (`packages/shared`) | 웹·서버 공용 |
| 날짜·문구 | 자체 유틸, 자체 경량 i18n | 번들 절약 |
| 지도 | Google·네이버·카카오 공식 스크립트, 대체 MapLibre | ADR-0004, ADR-0007 |
| PWA | 직접 만든 서비스 워커 + vite 플러그인 | 라이브러리 없음 |
| 서버 | Node.js, Fastify, node:sqlite, web-push | 마이그레이션은 `db/migrations.ts` |
| 인증 | 카카오·네이버·Google OAuth + 서버 세션 쿠키 | `docs/09` |
| 테스트 | Vitest, Testing Library, fake-indexeddb, Playwright(Chromium·WebKit) | `pnpm check`, `pnpm e2e` |
| 호스팅 | Cloudflare Pages + Functions, 홈 PC + Tailscale Funnel | ADR-0006, 작업 스케줄러로 자동 시작 |

## 3. 레이어 & 의존 규칙
```
app  ──▶  features  ──▶  shared (ui, hooks, lib)
                    ──▶  data (db, repositories, backup)
                    ──▶  domain (types, 순수 로직)
data ──▶ domain
shared ──▶ domain
domain ──▶ (없음. 외부 라이브러리는 date-fns 정도만)
```
- `features/A`는 `features/B`를 직접 import 하지 않는다. 공통이면 `shared`/`domain`으로 내린다.
- 규칙은 ESLint `import/no-restricted-paths`(또는 `eslint-plugin-boundaries`)로 강제.

## 4. 폴더 구조 (모노레포)
```
Travel_Planner/
├─ CLAUDE.md, README.md, pnpm-workspace.yaml, package.json
├─ docs/
├─ packages/
│  └─ shared/                  # 웹·서버 공용 (React/Node 의존 금지)
│     └─ src/ schemas/(Zod), sync/(프로토콜 타입), domain/(공용 순수 함수)
├─ apps/
│  ├─ web/
│  │  ├─ public/  index.html  vite.config.ts
│  │  ├─ src/
│  │  │  ├─ main.tsx
│  │  │  ├─ app/               # App, router, layouts(AppShell 하단 탭바), providers
│  │  │  ├─ features/
│  │  │  │  ├─ trips/ itinerary/ bookings/ checklist/ today/ saved/ quick-menu/ fx/ ai/
│  │  │  │  ├─ places/         # 장소 검색·필터·상세, 지도 화면
│  │  │  │  ├─ account/        # 로그인, 기기 관리, 탈퇴
│  │  │  │  └─ settings/
│  │  │  ├─ domain/            # 웹 전용 순수 로직
│  │  │  ├─ data/
│  │  │  │  ├─ db.ts  migrations/  repositories/  backup/
│  │  │  │  ├─ sync/           # push/pull 엔진, 충돌 처리
│  │  │  │  └─ api/            # 서버 API 클라이언트 (fetch 래퍼, 401 처리)
│  │  │  ├─ shared/
│  │  │  │  ├─ ui/  hooks/
│  │  │  │  ├─ maps/           # MapProvider, GoogleMapProvider, NaverMapProvider
│  │  │  │  └─ lib/            # directions.ts(딥링크), geolocation, id, clipboard
│  │  │  └─ i18n/  styles/
│  │  └─ tests/e2e/
│  └─ server/
│     ├─ src/
│     │  ├─ index.ts           # Fastify 부트스트랩 (helmet, cors, rate-limit, cookie)
│     │  ├─ config.ts          # .env 로드 + Zod 검증 (누락 시 기동 실패)
│     │  ├─ db/                # schema.ts, migrations/
│     │  ├─ auth/              # oauth(naver, kakao, google), session, requireUser
│     │  ├─ routes/            # sync, trips(members, invites), files, places, me, health
│     │  ├─ repositories/      # 모든 쿼리에 userId/멤버십 조건 강제
│     │  ├─ services/          # placesGoogle, placesNaver, quota, fx, aiRecommend(Claude API)
│     │  └─ lib/               # logger(마스킹), errors, crypto
│     ├─ test/
│     └─ .env.example
└─ ops/                        # 홈 PC 운영
   ├─ winsw/  cloudflared/     # 서비스 등록 설정
   ├─ backup.ps1  restore.ps1
   └─ README.md                # 설치·복구 절차
```

## 5. 데이터 흐름
- **읽기**: 컴포넌트 → `useTrip(id)` 같은 feature hook → repository → Dexie `useLiveQuery` → DB 변경 시 자동 재렌더.
- **쓰기**: 컴포넌트 → feature hook의 mutation → repository (Zod 검증 + `updatedAt` 갱신 + 트랜잭션) → Dexie.
- **전역 UI 상태**(현재 선택된 Day, 시트 열림 등)만 Zustand / URL 파라미터. 서버 상태 캐시 라이브러리 불필요.
- **URL이 상태**: `/trips/:tripId/day/:dayIndex` 처럼 화면 위치는 URL로 표현 → 새로고침/공유/뒤로가기 일관성.

## 6. 라우트 (초안)
| 경로 | 화면 |
|---|---|
| `/` | 홈: 진행 중 여행 있으면 "오늘", 없으면 여행 목록 |
| `/trips` | 여행 목록 |
| `/trips/new` | 여행 생성 |
| `/trips/:tripId` | 여행 개요 → 기본 일정 탭으로 리다이렉트 |
| `/trips/:tripId/plan?day=N` | 일정 (Day 탭) |
| `/trips/:tripId/map?day=N` | 지도 뷰 (P1) |
| `/trips/:tripId/bookings` | 예약 |
| `/trips/:tripId/checklist` | 준비물 |
| `/trips/:tripId/settings` | 여행 설정 (기간, 타임존, 멤버) |
| `/saved` | 저장한 장소 |
| `/tools/fx` | 환율 계산기 (빠른 메뉴에서 진입) |
| `/tools/ai` | AI 추천 (빠른 메뉴에서 진입) |
| `/s/:shareId` | 로그인 없이 보는 공유 일정 (읽기 전용) |
| `/import?d=...` | 공유 링크 가져오기 |
| `/trips/:tripId/places` | 장소 찾기 (카테고리·평점 필터) |
| `/places/:placeId` | 장소 상세 (시트로도 열림) |
| `/login`, `/auth/done` | 로그인 / OAuth 완료 처리 |
| `/invite/:token` | 여행 초대 수락 |
| `/settings/account` | 계정·동기화·기기 관리 |
| `/settings` | 앱 설정, 백업/복원 |

## 7. PWA / 오프라인 전략
- 직접 만든 서비스 워커(`src/sw/sw-template.js`): 앱 파일 미리 저장, 글꼴은 쓸 때 저장. `/api`·`/auth`는 가로채지 않는다
- 새 버전이 있으면 [업데이트] 안내 (편집 중 강제 새로고침 없음)
- 지도는 온라인에서만. 오프라인에서는 안내 + 지도 앱 오프라인 지도 팁·택시 카드
- 외부 API가 실패하거나 한도면 대체 API → 대체 기능 → 안내 팝업 순서 (`docs/23`)

## 8. 보안 / 개인정보
> 서버·인증·동기화 보안 전체 체크리스트는 `09-server-auth-security.md` §7.
- 사용자 데이터 전송은 홈 서버로만. CSP: `default-src 'self'` + API 도메인 + Google·네이버·카카오 지도 도메인만 허용.
- 공유 링크는 서버의 보기 전용 링크(128bit id, 언제든 끄기). 예약번호·연락처·메모는 기본 제외.
- 가져오기 데이터는 Zod로 전량 검증, HTML 렌더 시 `dangerouslySetInnerHTML` 금지 (XSS).
- 예약번호 등 민감 정보는 공유 내보내기 시 "포함/제외" 옵션 제공.

## 9. 성능 예산
- 초기 JS ≤ 300KB gzip (2026-10-24 상향). 지도·차트·DnD는 **라우트 단위 lazy import**.
- 리스트 200개 이상이면 가상화 고려 (현실적으로 Day당 아이템 수는 적어 우선 불필요).
- 이미지 첨부는 저장 전 리사이즈/압축 (긴 변 1600px, WebP/JPEG 0.8).

## 10. 확장 고려
- 동기화: 모든 엔티티에 `id(UUID v7)`, `createdAt`, `updatedAt`, `deletedAt`, `rev` → 서버 동기화(v0.2 도입). 필드 단위 병합/CRDT는 P2.
- 서버 이전: SQLite → PostgreSQL, 홈 PC → 클라우드 VM 이전이 가능하도록 DB 접근은 Drizzle + repository로 격리.
- 네이티브 앱화: Capacitor로 감싸기 가능하도록 브라우저 전용 API는 `shared/lib`에 어댑터로 격리.
