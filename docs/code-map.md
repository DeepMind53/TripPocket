# 코드 지도 (실제 구조) — 고칠 때 여기서 시작

> 2026-10-27 기준. `03-architecture.md`는 설계 초안이고, **지금 코드가 어떻게 생겼는지는 이 문서**가 기준이다.
> 구조가 바뀌면 이 문서도 같이 고친다.

## 1. 한눈에

```
휴대폰·PC 브라우저 ── https://trippocket.day (Cloudflare Pages: 정적 파일 + functions/)
   │  화면·데이터: IndexedDB(Dexie)가 1차 저장소 → 서버 없이도 전부 동작
   │  /api/*, /auth/* 만 ─▶ functions/_proxy.ts (비밀 헤더 x-tp-proxy + 들어온 주소 x-tp-origin)
   ▼
Tailscale Funnel https://jin-server.tail0844c0.ts.net ─▶ 홈 PC 127.0.0.1:8787 (Fastify + node:sqlite)
   └─▶ 외부 API: Google Places·Routes · Geoapify · NAVER API HUB · 카카오 로컬 · 수출입은행 · AviationStack
        · Gemini → Workers AI → Groq · 특보(GDACS·USGS·외교부·기상청 한국·일본·미국·대만·캐나다)
```

- 옛 주소 `trippocket.pages.dev`의 화면 이동은 `functions/_middleware.ts`가 새 주소로 301. 앱 파일·API·로그인은 그대로 통과
  (설치된 앱은 `MovedBanner`로 안내). 서버 `WEB_ORIGIN`은 두 주소를 모두 허용
- 결정 근거: ADR-0001(로컬 우선)·0002(PWA)·0003(홈 PC 서버)·0004(지도)·0005(스택)·0006(Pages 프록시)·0007(무료 백업)·0008(여행지 특보)

## 2. 폴더

| 위치 | 하는 일 |
|---|---|
| `packages/shared/src` | 웹·서버 공용 **순수 함수와 Zod 스키마**. 날짜(`date/`), 정렬 키(`order/`), 스키마(`schema/`), 설정·백업·동기화 형식, 장소 데이터·검색(`data/`, `places/`), 환율(`fx/`), 공유용 변환(`share/`), AI 점수(`ai/`), 거리(`geo/`) |
| `apps/web/src/app` | 라우터(`router.tsx`, 화면은 모두 지연 로딩), 레이아웃(`layouts/AppShell`·`TripLayout` — 하단 탭과 ⚡ 플로팅 버튼), PWA 등록(`pwa.ts`) |
| `apps/web/src/features/<기능>` | 화면 단위. 기능끼리는 `features/common`만 함께 쓴다 |
| `apps/web/src/data` | **DB 접근은 여기만**: `repositories/`(Dexie), `services/`(여러 저장소를 묶는 일), `sync/`(동기화 엔진), `api/`(서버 호출 — `client.ts`의 `api()`는 오류 대신 결과 종류를 돌려준다), 작은 스토어(`authStore`·`settingsStore`·`labsStore`) |
| `apps/web/src/domain` | 웹 전용 순수 로직 (숙소 밤 계산·일정 정렬·공유 텍스트 등) |
| `apps/web/src/shared` | UI 부품(`ui/`), 훅(`hooks/`), 유틸(`lib/`), 지도 SDK 감싸기(`maps/`) |
| `apps/web/src/sw/sw-template.js` | 직접 만든 서비스 워커 (빌드 때 `vite.config.ts` 플러그인이 파일 목록을 채움) |
| `apps/web/public` | `_headers`(CSP·캐시), `_routes.json`(함수가 도는 경로 — 앱 파일 제외), 아이콘·매니페스트 |
| `apps/server/src/routes` | API. `auth`(소셜 로그인·가입 요청), `me`, `admin`(사용자 관리·API 사용량), `sync`, `share`, `places`, `ai`, `usage`(지도 로드 기록), `routes`(이동 시간), `flights`, `reviews`, `push`, `attachments`(예약 문서), `suggestions`(개선 제안), `alerts`(여행지 특보) |
| `apps/server/src/services` | 외부 API 호출. **모든 외부 호출은 `apiUsage.ts`의 `guardApi`/`trackApi`를 거친다** |
| `apps/server/src/db` | `migrations.ts` — 이미 배포된 항목은 고치지 말고 뒤에 추가 (지금 17번까지) |
| `functions/` | Cloudflare Pages Functions: `_proxy.ts`(→ 홈 서버), `_middleware.ts`(옛 주소 이동) |
| `ops/` | 홈 PC 설치(`install.ps1`, 작업 스케줄러 S4U)·Funnel·운영 문서·`restart-server.ps1`(바탕화면 "TripPocket 서버 재시작.bat") |
| `apps/server/.env` | 비밀값·키. 기능별로 묶고 키마다 [유효기간] 안내 (`.env.example`이 같은 틀, 값 비움). 값은 절대 출력·커밋하지 않는다 |

레이어 방향: `app → features → shared / data / domain` (거꾸로 금지), `packages/shared`는 앱을 import 하지 않는다.

## 3. 자주 하는 수정 — 어디를 고치나

- **화면 문구**: `apps/web/src/i18n/ko.json` (키는 타입 검사됨 — 없는 키는 빌드 실패)
- **새 화면**: `features/<기능>/XxxPage.tsx` + `app/router.tsx`에 `lazy` 경로. 첫 화면 예산 300KB(`pnpm size`)
- **새 설정 항목**: shared `settings/settings.ts`(검사·기본값) → `SettingsPage`
- **새 실험 기능**: `data/labsStore.ts`의 `LABS`에 id 추가 → `ko.json` `labs.item.<id>.name/desc` → 기능 코드에서 `useLab('<id>')`.
  정식 기능이 되면 `LABS`에서 빼고 `useLab` 분기를 지운다
- **새 외부 API (서버)**: `services/apiUsage.ts`의 `APIS`에 id·분류(`paid`=과금 가능 / `free`)·무료 월 사용량 추가 →
  호출 직전에 `guardApi(id)`(멈춤이면 `ApiPaused` → 503 `api_paused`), `trackApi(id)` → `ko.json` `apiUsage.name/note`.
  브라우저에서 직접 부르는 유료 API는 `routes/usage.ts`처럼 허용 여부 확인 + 사용 기록 엔드포인트를 둔다
- **AI 엔진 추가·순서**: `services/llm.ts`의 `llmProviders` (OpenAI 호환이면 주소·키·모델만). 모두 실패하면 `basicRecommend.ts`(AI 없이)
- **서버 DB 표 추가**: `db/migrations.ts` 끝에 새 항목 + 테스트
- **웹 DB 표 추가**: `data/db.ts` 버전 올림 + `data/migrations` + 마이그레이션 테스트 (CLAUDE.md)
- **관리자 전용 기능**: 서버는 `routes/admin.ts`의 `requireAdmin`, 웹은 `useAuth((s) => s.me?.isAdmin)`로 메뉴 표시
- **삭제 확인 팝업**: `shared/ui/confirmStore.ts`의 `confirmDelete(문구)` (모든 삭제는 한 번 더 묻는다)
- **여행지 특보 나라 추가**: 링크는 shared `alerts/alerts.ts` `WEATHER_WARNING_LINKS`, 내용은 서버 `services/nationalAlerts.ts`에 파서 + `APIS` 등록 + docs/24 §7 표
- **월간 갱신 요청문**: 주기적으로 확인할 정보를 넣으면 `features/me/monthlyUpdate.ko.ts`와 docs/22에 함께 더한다

## 4. 주요 흐름

- **로그인**: `/auth/<제공자>/start` → 제공자 → `/auth/<제공자>/callback`. state는 서버 저장 + `__Host-oauth` 쿠키로 대조, 구글은 PKCE.
  콜백 주소는 사용자가 들어온 주소 기준(`requestOrigin`). 처음 보는 계정 → 첫 계정이면 관리자로 가입, 아니면 가입 요청(`join_requests`)
- **동기화**: 기기에서 고친 행에 `dirty` → `syncEngine` push(행마다 멤버십 인가) → pull(서버 rev 이후). 충돌은 나중 도착 채택 + `conflicts` 보관
- **AI 추천** (`routes/ai.ts`): 기준점(가까운 역·숙소·직접 입력 — 드롭다운에서 고르면 그 장소 좌표) → 카테고리(맛집·카페·놀거리 + 직접 키워드 `custom`)끼리 동시에 {
  블로그 수집(NAVER API HUB) → AI 장소 추출(Gemini → Workers AI → Groq → 없으면 지도 검색 + 언급 수) → 근거 id 검증·점수(shared `buildRecommendations`) →
  **국내**: 카카오로 위치 확인, 가까운 곳이 모자라면 Google 장소로 채움 / **해외**: Google 장소 검색이 먼저, 블로그 언급·요약을 이름으로 붙임(블로그에만 있는 곳은 뒤) →
  거리 단계 5 → 10km(shared `pickRadius`, 3곳 이상이면 그 반경, 10km 밖·위치 모르는 곳은 뺀다 — 2026-10-27) } → 6시간 캐시.
  Google 장소 정보는 AI에 보내지 않는다(목록에만 표시). Google 장소 검색은 API 사용량 자동 중지 안에서만 — 멈추면 블로그만으로
- **API 사용량**: `api_usage`(날짜별 호출 수, 날짜는 API마다 무료량 초기화 시간대) + `api_controls`(수동 중지·월/하루 자동 상한).
  무료 월·하루 사용량을 아는 API는 그 95%(남은 5%)에서 자동 중지 (2026-10-27, 전에는 90%). 서버 호출은 `guardApi`/`trackApi`, 브라우저 호출은
  `data/api/usage.ts`의 `externalAllowed`/`reportExternal`(→ `/api/usage/flags`·`/api/usage/map-load`, IP당 하루 100회까지만 셈)

- **후기·포인트** (docs/17): 템플릿·장소 키·검사 = shared `reviews/reviews.ts` (`REVIEW_ASPECTS`·`placeKeyOf`·`ReviewInputSchema`) →
  서버 `routes/reviews.ts`(쓰기는 소유자·편집자만, 동기화된 지난 일정만, 포인트는 서버만 `point_ledger`) →
  웹 `features/reviews/`(상세 시트 [후기 입력]·목록, `ReviewSheet`, `/me/reviews`), 오프라인은 `data/reviewQueue.ts`(동기화 뒤 올림).
  닉네임 가리기 = `users.hide_nickname` → 보여 줄 때 `User#public_no`, 탈퇴하면 후기의 user_id만 NULL
- **삭제·복원**: 지우면 `deletedAt`(삭제 표시)만 → 마이 → 삭제 기록 복원(`trashRepo`, 7일). 기기는 동기화된 7일 지난 삭제 표시를 한가할 때 정리,
  서버는 `services/maintenance.ts`가 6시간마다 7일 지난 삭제 기록의 내용을 비우고(`purged`) 표시만 남긴다. 받은 기기는 `domain/tombstone.ts` 기준으로 바로 지운다
- **여행지 특보** (docs/24·ADR-0008): 웹 `features/weather/DestinationAlerts`·`useTripAlerts` → `GET /api/alerts?countries=&points=` →
  서버 `services/alerts.ts`(GDACS·USGS·외교부, 10분·3시간 보관) + `nationalAlerts.ts`(기상청: 한국 전국·대만 전국·일본·미국·캐나다는 목적지 좌표 약 10km).
  알림은 `services/alertPush.ts`(출발 7일 전~귀국일, 새 빨강 특보, 여행마다 하루 1번) — `pushScheduler`가 30분마다

### API 사용량 — 등록된 외부 API와 무료 사용량

> Google 장소(검색 Text Search Pro 월 5,000 · 상세 Enterprise 월 1,000 · 현지어 이름 Pro 월 5,000)는 **월 단위 과금이라 하루 한도 없음 (2026-10-26 사용자 결정)** — 월 95% 자동 중지만. 과금 기준은 매번 최신 공식 자료로 확인 (docs/22 B1)
 (2026-10-24 최신 자료로 확인)

| id | 분류 | 무료 사용량 (자동 중지 = 95%) | 근거·메모 |
|---|---|---|---|
| google_places_search | 과금 가능 | 월 5,000 | Text Search **Pro** (FieldMask: id·이름·주소·좌표·지도 링크). 2025-03 SKU별 무료: Essentials 1만·Pro 5천·Enterprise 1천 |
| google_places_details | 과금 가능 | 월 1,000 | Place Details **Enterprise** (평점·영업시간·전화·웹사이트). FieldMask를 바꾸면 등급이 바뀌니 주의 |
| google_maps_js | 과금 가능 | 월 10,000 | Dynamic Maps (지도 1회 로드). 브라우저 |
| google_autocomplete | 과금 가능 | 월 10,000 | **검색 백업**(docs/23·ADR-0007): Text Search 무료량이 끝나면 Autocomplete (New). 세션 토큰 |
| google_details_basic | 과금 가능 | 월 10,000 | 자동완성에서 고른 장소의 주소·좌표 — Place Details **Essentials** (FieldMask: formattedAddress,location) |
| google_routes | 과금 가능 | 월 10,000 | 다음 일정 바·구간 시간: Compute Routes Essentials(걷기·대중교통 2건씩, FieldMask: routes.duration). Google 좌표가 낀 구간만 — 나머지는 Geoapify 먼저. 둘 다 없으면 웹이 직선거리로 어림(팝업 없음). `services/routes.ts`·`POST /api/routes/eta` |
| geoapify | 무료 | 하루 3,000 | Google 백업까지 멈추면 검색·택시 카드(역지오코딩), 출발 시각(걷기·approximated_transit). OSM 데이터, 출처 표기 필수. 키 `GEOAPIFY_KEY` |
| openfreemap | 무료 | 없음 | 지도 백업(MapLibre). Google·네이버 지도를 못 쓸 때. 기록만. 브라우저 |
| naver_maps_js | 과금 가능 | 하루·월 6,000,000 | NCP Maps Web Dynamic Map, **대표 계정만** 무료 이용량 (2026-10-24 콘솔 확인: 대표 계정). 브라우저 |
| kakao_map | 과금 가능 | 월 3,000,000 (합산) | 카카오맵 REST API 전체 월 합산 묶음(`pool`). 멈추면 아래 카카오 API 모두 멈춤. 무료 쿼터는 개발자 계정의 첫 카카오맵 앱만(이 앱은 받음, 2026-10-24 사용자 확인) |
| kakao_keyword | 과금 가능 | 하루 100,000 | 키워드로 장소 검색, 넘으면 2원/건 |
| kakao_category | 과금 가능 | 하루 100,000 | 카테고리로 장소 검색(가까운 역), 넘으면 2원/건 |
| naver_search | 과금 가능 | 월 775,000 · 하루 25,000 | NAVER API HUB 한시적 무료, 유료 전환은 사전 공지 예정. 하루 값은 옛 개발자센터 기준 |
| gemini | 무료 | 하루 500 | 결제 없는 프로젝트 → 넘으면 거절. Flash-Lite 하루 500~1,000 (태평양 자정) |
| workers-ai | 무료 | 하루 50 | 무료 플랜 1만 Neurons/일 ≈ 분석 50회. Workers 유료 플랜이면 과금되므로 유지 |
| groq | 무료 | 하루 1,000 | 카드 없음 |
| exim | 무료 | 하루 1,000 | |
| aviationstack | 무료 | 월 100 (하루 제한 없음) | 편명으로 항공편 불러오기 — 최근 운항(실시간)만, 미래 시간표는 유료. 같은 편명 7일 저장. 무료는 HTTPS 막힘 → 서버에서 HTTP로 |
| overpass | 무료 | 하루 100 | 공용 서버 정책(1만 미만, 꾸준한 사용은 1/100). User-Agent 필수 |
| open_meteo | 무료 | 하루 10,000 | 비상업, IP당. 브라우저 |
| nager_date · jsdelivr | 무료 | 없음 | 브라우저 |
| oauth_kakao/naver/google | 무료 | 없음 | 기록만 (멈추면 로그인 불가) |
| cf_functions | 무료 | 하루 100,000 | Pages Functions 무료 플랜(넘으면 오류). 홈 서버까지 온 요청만 셈. 기록만 |
| web_push | 무료 | 없음 | 브라우저 회사 푸시 서버. 기록만 |
| gdacs · usgs | 무료 | 없음 | 여행지 특보 (전 세계 재난·지진). 10분에 한 번만 받음. 기록만 |
| mofa_alert | 무료 | 하루 10,000 | 외교부 여행경보·특별여행주의보 (공공데이터포털 `DATA_GO_KR_KEY`). 3시간 보관 |
| kma_warning | 무료 | 하루 10,000 | 한국 기상청 특보 현황 (같은 키). 10분 보관 |
| jma · nws · cwa · eccc | 무료 | 없음 | 일본·미국·대만(`CWA_API_KEY`)·캐나다 기상청 특보. 10분 보관. 기록만 |

새 외부 API를 넣으면 이 표와 `APIS`를 함께 고친다 (`test/apiUsage.test.ts`가 등록 누락을 잡는다)

## 5. 확인 명령

```
pnpm check          # lint + 타입 + 단위 테스트 (shared·server·web)
pnpm e2e            # Playwright (모바일 화면 + 배포 빌드의 오프라인·CSP)
pnpm --filter @trippocket/web size   # 첫 화면 합계 (빌드 후 측정, 예산 300KB)
pnpm format:check
```

- 실제 키로 외부 API를 시험할 때는 `apps/server/test/`에 임시 테스트를 만들어 `node --env-file=.env ./node_modules/vitest/vitest.mjs run <파일>`로 돌리고 지운다 (키는 출력하지 않는다)
- 서버 반영: `pnpm --filter @trippocket/server build` → `ops/restart-server.ps1` (작업 스케줄러 TripPocket Server를 끄고 3초 뒤 다시 켬)
