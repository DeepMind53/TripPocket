# 03. 아키텍처

- 문서 상태: **설계 초안** (구현 전). 실제로 만든 구조·호스팅은 [`code-map.md`](code-map.md)가 기준이다
  (예: Cloudflare Tunnel → Pages 프록시 + Tailscale Funnel(ADR-0006), vite-plugin-pwa → 직접 만든 서비스 워커, i18next → 자체 경량 i18n)

## 1. 전체 구조
> v0.2 변경: 홈 PC 동기화 서버(ADR-0003), 구글·네이버 지도(ADR-0004) 반영. 서버 상세는 `09-server-auth-security.md`.

```
┌──────────────── 사용자 휴대폰 (브라우저 / PWA) ────────────────┐
│ UI (React) ─ features: trips, itinerary, bookings, checklist,  │
│              places(지도·검색·길찾기), saved, account          │
│     │ hooks                                                    │
│ data/repositories ──▶ IndexedDB (1차 저장, 오프라인 동작)       │
│ sync engine ── dirty 레코드 push / 변경 pull ──┐               │
│ Service Worker (앱 셸 캐시)                    │               │
└────────────────────────────────────────────────┼───────────────┘
           ▲ 정적 파일                            │ HTTPS (쿠키 세션)
┌──────────┴──────────┐                ┌──────────▼──────────┐
│ Cloudflare Pages    │                │ Cloudflare (TLS·WAF) │
│ (웹앱 호스팅)        │                └──────────┬──────────┘
└─────────────────────┘                           │ Tunnel (아웃바운드, 인바운드 포트 0)
                                       ┌──────────▼──────────────────────┐
  지도 SDK (브라우저 키, 도메인 제한)    │ 홈 PC: Node.js API (127.0.0.1)  │
  Google Maps JS / Naver Maps JS        │  auth · sync · files · places   │
  길찾기 = 지도 앱 딥링크 (무료)         │  SQLite + files/ + 암호화 백업   │
                                       │  ──▶ Google Places API (서버 키) │
                                       │  ──▶ 네이버 검색 API             │
                                       └─────────────────────────────────┘
```
- **로컬 모드**(비로그인): 서버 호출 없이 모든 핵심 기능 동작 (장소 검색만 비활성, 길찾기 딥링크는 가능).
- **로그인 모드**: 로컬 DB에 먼저 쓰고, sync 엔진이 백그라운드로 서버와 맞춘다.

## 2. 기술 스택 (제안)
| 영역 | 제안 | 이유 | 대안 |
|---|---|---|---|
| 언어 | **TypeScript (strict)** | 데이터 모델이 복잡 → 타입 안정성 | — |
| 빌드 | **Vite** | 빠름, PWA 플러그인 성숙 | — |
| UI | **React 19** ⚠️ | 생태계·자료 최다, AI 도움 받기 쉬움 | Svelte 5(번들 작음), Vue 3 |
| 라우팅 | **React Router** (또는 TanStack Router) ⚠️ | 표준적 | — |
| 스타일 | **Tailwind CSS v4** ⚠️ | 모바일 UI 빠른 구현, 일관된 토큰 | CSS Modules |
| UI 프리미티브 | **Radix UI / shadcn/ui** (필요한 것만) | 접근성 갖춘 시트·다이얼로그 | — |
| 로컬 DB | **Dexie.js** (IndexedDB 래퍼) | 스키마 버전/마이그레이션, `useLiveQuery`로 반응형 | idb, RxDB(과함) |
| 상태 | DB = 단일 진실 원천. UI 임시 상태만 **Zustand** | 상태 중복 방지 | — |
| 폼/검증 | **React Hook Form + Zod** | Zod 스키마를 가져오기(import) 검증에도 재사용 | Valibot(더 가벼움) |
| 날짜 | **date-fns** + `Intl` (타임존) | 트리셰이킹, 가벼움 | Temporal API(지원 확대 시 전환) |
| 드래그 | **dnd-kit** | 터치 지원, 접근성 | — |
| 지도 | **Google Maps JS + Naver Maps JS v3** (`MapProvider` 추상화) | 국내=네이버, 해외=구글 (ADR-0004) | Leaflet+OSM(보조) |
| 장소/평점 | **Google Places API (New)** via 홈 서버 프록시 | 평점·리뷰 제공 유일 | — |
| 서버 | **Node.js 24 + Fastify + SQLite(Drizzle)** on 홈 PC | `09` 문서 참조 | Hono |
| 인증 | **소셜 OAuth(네이버/카카오/구글) + 서버 세션 쿠키** | 비밀번호 미저장 | — |
| PWA | **vite-plugin-pwa (Workbox)** | 매니페스트+SW 자동 생성 | — |
| i18n | **i18next** 또는 경량 자체 구현 ⚠️ | 한국어 우선, 영어 추가 | — |
| 아이콘 | **lucide-react** | 트리셰이킹 | — |
| 테스트 | **Vitest + Testing Library + fake-indexeddb**, **Playwright** | Vite 통합, 모바일 뷰포트 E2E | — |
| 품질 | **ESLint (flat) + Prettier + typescript-eslint**, Husky + lint-staged | — | Biome |
| 호스팅 | 웹: **Cloudflare Pages**, API: **홈 PC + Cloudflare Tunnel** ⚠️ | 같은 도메인 계열 → 쿠키 세션, PC 꺼져도 앱 열림 | — |
| 모노레포 | **pnpm workspaces** ⚠️ | web/server/shared 타입 공유 | npm workspaces |

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
- `vite-plugin-pwa` `generateSW`, 앱 셸 + 모든 빌드 산출물 precache.
- 업데이트 방식: `registerType: 'prompt'` → "새 버전이 있어요 [업데이트]" 토스트 (편집 중 강제 새로고침 방지).
- 지도 타일: runtime cache (StaleWhileRevalidate, 최대 개수 제한). 오프라인 지도 완전 지원은 P2.
- 외부 API 실패 시 UI는 항상 **degrade gracefully** (예: 지도 대신 주소 텍스트 + 지도 앱 열기 버튼).

## 8. 보안 / 개인정보
> 서버·인증·동기화 보안 전체 체크리스트는 `09-server-auth-security.md` §7.
- 사용자 데이터 전송은 홈 서버로만. CSP: `default-src 'self'` + API 도메인 + Google/Naver 지도 도메인만 허용.
- 공유 링크는 데이터가 URL **fragment(#)** 에 들어가도록 → 호스팅 서버 로그에 남지 않음.
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
