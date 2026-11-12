# 03. 아키텍처

- 문서 상태: **현행** (2026-11-12 전면 갱신 — 처음 설계안의 폴더·라우트를 실제 구조로 바꿈)
- 이 문서 = 전체 그림과 **왜** 그렇게 했나. 파일 단위로 **어디를** 고치나는 [`code-map.md`](code-map.md). 문서 목록은 [`README.md`](README.md)
- 구조가 바뀌면 같은 커밋에서 이 문서와 code-map을 고친다

## 1. 전체 구조

```
휴대폰·PC 브라우저 (PWA, https://trippocket.day)
  UI (React) ─ features ─ data/repositories ─▶ IndexedDB (Dexie v14, 1차 저장 — 서버 없이 모든 핵심 기능)
  기기 전용: 사진·영수증(photos 표), 개인정보(여권 만료 등), 최근 백업 3개(OPFS 파일) — 서버·동기화로 보내지 않음
  동기화 엔진 ─ 고친 행(dirty) 올리기 / 바뀐 행 받기 (시작·복귀·고친 뒤·30초마다)
  서비스 워커 (직접 작성, 앱 파일 미리 저장, /api·/auth는 가로채지 않음)
  지도 SDK ─ 지도를 열 때만 불러옴: 해외 Google / 국내 네이버·카카오(설정) / 막히면 MapLibre + OpenFreeMap
  길찾기 ─ 지도 앱 딥링크 · 영수증 글자 인식 마지막 단계 ─ 기기 안 Tesseract.js
       │ 같은 주소 (쿠키 세션, 로그인한 사람만 — app/AuthGate.tsx)
       ▼
Cloudflare Pages ─ 정적 파일 + Functions가 /api·/auth만 전달 (비밀 헤더 x-tp-proxy, ADR-0006)
       │ Tailscale Funnel
       ▼
홈 PC: Node.js + Fastify (127.0.0.1:8787, 비밀 헤더 없으면 404)
  로그인(카카오·Google)·동기화·공유·후기·알림·예약 문서·숙소 가격 기록·사용 통계
  SQLite(node:sqlite, 마이그레이션 23) + 첨부 파일 + 암호화 백업(매일 03:00)
  외부 API는 모두 services/apiUsage.ts를 거친다: 호출 직전 guardApi(멈춤·한도 확인) + trackApi(기록), 무료량 95%에서 자동 중지
    장소: 국내 네이버 → 카카오 / 해외 Google → 자동완성 → Geoapify
    AI: Gemini → Workers AI → Groq → AI 없이 · 글자 인식: Google Vision → Azure Read (→ 웹이 기기 안에서)
    특보: GDACS·USGS·외교부·나라별 기상청 · 항공편: AviationStack·AirLabs·공항공사 · 길 시간: Google Routes·Geoapify
    숙소 최저가: 아고다 찾기·SerpApi · 공공데이터포털(입국·안전공지·축제·미세먼지) · 위키백과 · 수출입은행
```

- 사용자 위치는 저장·기록하지 않는다 (줄여서 계산에만). 사용자 데이터는 홈 서버로만 보낸다 (CLAUDE.md §3)
- 결정 근거: ADR-0001~0012 ([`adr/`](adr/))

## 2. 기술 스택 (실제)

| 영역 | 사용 | 메모 |
|---|---|---|
| 언어·빌드 | TypeScript strict, Vite, pnpm workspaces | ADR-0005 |
| UI | React 19, React Router, Tailwind CSS 4, Radix(시트 등 필요한 것만), lucide-react, dnd-kit(편집 때만) | 시트·무거운 화면은 처음 열 때 불러옴 |
| 디자인 | 토큰 + "여행 노선" 부품(노선·탑승권·다음 역 카드·도장), unslop 규칙 | docs/11 §13, docs/29, ADR-0011 |
| 로컬 DB·상태 | Dexie(IndexedDB), Zustand | UI는 항상 로컬 DB에서 읽는다 |
| 검증 | `zod/mini` (`packages/shared`) | 웹·서버 공용 |
| 날짜·문구 | 자체 유틸, 자체 경량 i18n (`ko.json`, 키 타입 검사) | 번들 절약 |
| 지도 | Google·네이버·카카오 공식 스크립트, 대체 MapLibre | ADR-0004, ADR-0007 |
| 글자 인식 | 서버 Google Vision → Azure Read, 기기 Tesseract.js(누를 때만 불러옴) | ADR-0012 |
| PWA | 직접 만든 서비스 워커 + vite 플러그인 | 라이브러리 없음 |
| 서버 | Node.js, Fastify, node:sqlite, web-push | ORM 없이 repository에서 SQL |
| 인증 | 카카오·Google OAuth + 서버 세션 쿠키 (네이버는 2026-11-03 뺌) | docs/09 |
| 테스트 | Vitest, Testing Library, fake-indexeddb, Playwright(Chromium·WebKit) | `pnpm check`, `pnpm e2e` |
| 호스팅 | Cloudflare Pages + Functions, 홈 PC + Tailscale Funnel | ADR-0006, 작업 스케줄러로 자동 시작 |

## 3. 레이어 & 의존 규칙

```
app  ──▶  features  ──▶  shared (ui, hooks, lib, maps)
                    ──▶  data (db, repositories, services, sync, api)
                    ──▶  domain (웹 전용 순수 로직)
data ──▶ domain        shared ──▶ domain
모든 앱 ──▶ packages/shared (공용 스키마·순수 함수)  /  packages/shared ──▶ (앱을 모름)
```
- 거꾸로 import 하지 않는다. **lint로 강제하는 것**: `packages/shared`가 React·앱 코드를 import 하면 오류 (`eslint.config.js`)
- 기능끼리: 둘 이상이 쓰는 것은 `features/common`으로 내린다. 한 기능이 다른 기능의 화면 조각을 그대로 쓰는 것은 허용하되 꼭 필요할 때만
  (지금 예: 기록 → 사진 창·일정 종류 아이콘, 마이 → 법적 고지 도움말 내용). 셋 이상이 쓰게 되면 common으로 옮긴다
- DB 접근은 repository만 (웹 `data/repositories`, 서버 `repositories`). 컴포넌트·라우트에서 DB를 직접 부르지 않는다

## 4. 폴더 (요약 — 상세는 code-map §2)

```
Travel_Planner/
├─ CLAUDE.md · PROGRESS.md · README.md
├─ docs/            # README.md(목록) · code-map · 번호 문서 · adr/ · conventions/
├─ packages/shared/ # schema · date · order · settings · backup · sync · data(입국·공항·회화 등) · alerts · ai · lodging · ocr · vision
├─ apps/web/        # src/{app, features/*, data, domain, shared, i18n, styles, sw} · public · tests/e2e · scripts
├─ apps/server/     # src/{routes, services, repositories, db, auth} · test
├─ functions/       # Cloudflare Pages Functions (_proxy, _middleware)
└─ ops/             # 홈 PC 설치·Funnel·백업·복구·재시작
```

## 5. 데이터 흐름

- **읽기**: 컴포넌트 → repository → Dexie `useLiveQuery` → DB가 바뀌면 다시 그림
- **쓰기**: 컴포넌트 → repository (Zod 검증 + `updatedAt` + `dirty` + 트랜잭션) → Dexie → 동기화 엔진이 올림
- **삭제**: `deletedAt` 표시만 → 7일 휴지통(`trashRepo`) → 기기·서버 정리. 기기 전용 사진은 일정이 아예 지워질 때 함께 지움
- **화면 상태**: 위치는 URL(`?day=`·시트 이름), 잠깐 상태는 Zustand·컴포넌트
- **시트**: 한 번에 하나만 보인다 (`shared/ui/sheetStack.ts` — 위 시트가 열리면 아래 시트를 숨기고 "뒤로")

## 6. 라우트 (실제, `apps/web/src/app/router.tsx`)

| 경로 | 화면 |
|---|---|
| `/` | 홈: 여행 중 다음 일정 카드·오늘 노선·준비 현황·내 여행 |
| `/trips`, `/trips/new` | 내 여행 · 만들기 |
| `/trips/:tripId/plan?day=N` | 일정 (노선·지도·날씨 주의·이동 정보) |
| `/trips/:tripId/places`, `/bookings`, `/checklist` | 가고 싶은 곳 · 예약 · 준비물/할 일 |
| `/trips/:tripId/essentials`, `/weather`, `/go`, `/print`, `/settings` | 출국 준비 · 날씨·특보 · 여행 모드 · 인쇄용 · 여행 설정 |
| `/records`, `/saved`, `/me`, `/help` | 기록(도장·회고·사진 모아보기) · 저장한 장소 · 마이 · 도움말 |
| `/me/profile`, `/me/reviews`, `/me/trash`, `/me/suggestions` | 개인정보 · 내 후기 · 삭제 기록 복원 · 개선 제안 |
| `/ai`, `/fx`, `/phrases`, `/lodging-price` | AI 추천 · 환율 · 번역·회화(건강 카드) · 숙소 최저가 |
| `/settings`, `/backup`, `/labs`, `/legal/:doc` | 설정 · 백업·복원 · 실험실 · 법적 고지 |
| `/admin/users`, `/admin/stats`, `/admin/api-usage`, `/admin/entry-check`, `/admin/lodging`, `/admin/ai`, `/admin/suggestions` | 관리자 (`AdminGate`) |
| `/s/:shareId`, `/invite/:token`, `/login` | 보기 전용 공유 · 초대 수락 · 로그인 (로그인 없이 여는 화면) |
| `/dev/ui`, `/dev/db` | 개발용 (개발 빌드만) |

## 7. PWA / 오프라인 전략

- 서비스 워커(`src/sw/sw-template.js`): 앱 파일 미리 저장, 글꼴은 쓸 때 저장. `/api`·`/auth`는 가로채지 않는다
- 새 버전이 있으면 [업데이트] 안내 (편집 중 강제 새로고침 없음)
- 지도는 온라인에서만. 오프라인에서는 안내 + 지도 앱 오프라인 지도 팁·택시 카드
- 외부 API가 실패하거나 한도면 대체 API → 대체 기능 → 안내 팝업 순서 (docs/23)
- 백업: 파일(공유 시트·다운로드, PC는 폴더 기억) + 이 기기에 최근 3개 (`data/services/localBackups.ts`)

## 8. 보안 / 개인정보

> 서버·인증·동기화 보안 전체 점검표는 `09-server-auth-security.md` §7.
- 사용자 데이터 전송은 홈 서버로만. CSP: `default-src 'self'` + API·지도 도메인만 (`public/_headers`, E2E로 위반 검사)
- 서버의 모든 데이터 접근은 `requireUser` + 여행 멤버십 인가 (`syncRepo`가 행마다)
- 공유 링크는 보기 전용(128bit id, 언제든 끄기). 예약번호·연락처·메모는 기본 제외 (shared `toPublicTrip`)
- 가져오기 데이터는 Zod로 전량 검증, `dangerouslySetInnerHTML` 금지
- 비밀값은 `apps/server/.env`에만 (커밋·출력 금지), 브라우저 키는 도메인 제한

## 9. 성능 예산

- 첫 화면 JS ≤ 300KB gzip (`pnpm size`, 2026-10-24 상향). 화면은 라우트 단위 지연 로딩, 시트는 처음 열 때
- 사진은 저장 전 줄여 저장 (기기 전용), 글자 인식 엔진은 누를 때만 불러옴

## 10. 확장 고려

- 동기화: 모든 엔티티에 `id(UUID v7)`, `createdAt`, `updatedAt`, `deletedAt`, `rev`. 충돌은 나중 도착 채택 + `conflicts` 보관 (필드 단위 병합은 나중)
- 서버 이전: DB 접근이 repository 안에만 있어 SQLite → 다른 DB, 홈 PC → 클라우드 VM 이전이 가능
- 네이티브 앱화: Capacitor로 감싸기 가능하도록 브라우저 전용 API는 `shared/lib`·`data/services`에 감싼다
