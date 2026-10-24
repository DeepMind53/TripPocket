# CLAUDE.md — AI 협업 규칙

이 파일은 Claude(및 다른 AI 도구)가 이 저장소에서 작업할 때 **항상 따라야 하는 규칙**이다.
사람 개발자에게도 동일하게 적용된다.

## 1. 프로젝트 한 줄 요약

오프라인 우선 PWA 여행 일정 앱(https://trippocket.day). 데이터의 1차 저장소는 기기 IndexedDB이고, 로그인하면 홈 PC 서버(Node.js + SQLite, Cloudflare Pages 프록시 → Tailscale Funnel)와 동기화한다.
지도는 구글/네이버 병행, 평점·리뷰는 Google Places(서버 프록시), 길찾기는 지도 앱 딥링크.
상세: `README.md`, `docs/` 참조. 서버의 공개 API도 로그인 필요(예외: 보기 전용 링크 `/api/public/*`, 로그인 `/auth/*`). **코드를 고칠 때는 `docs/code-map.md`(실제 구조·수정 위치)부터.**

## 2. 작업 시작 전 반드시 확인

0. `PROGRESS.md` — 현재 단계와 지난 피드백. 구현은 `docs/15-implementation-steps.md`의 단계 단위로만 진행하고, 단계가 끝나면 사용자 확인 전까지 다음 단계로 넘어가지 않는다. 필요한 문서만 골라 읽는다.
1. `docs/08-open-decisions.md` — 아직 확정되지 않은 결정이 있으면 임의로 정하지 말고 사용자에게 묻는다.
2. `docs/adr/` — 확정된 결정. ADR과 충돌하는 구현을 하지 않는다. 바꿔야 하면 새 ADR을 제안한다.
3. `docs/07-roadmap.md` — 현재 마일스톤 범위 밖의 기능은 만들지 않는다 (scope creep 금지).

## 3. 절대 규칙 (MUST / MUST NOT)

- **MUST** 앱은 **로그인한 사람만** 쓴다 (`app/AuthGate.tsx`, 2026-10-24 사용자 결정 — 외부인이 지도·AI 등 API를 쓰지 못하게). 단 이 기기에서 로그인한 적 있으면 서버 없이도(오프라인) 모든 핵심 기능이 동작해야 한다. UI는 항상 로컬 DB에서 읽는다. 로그인 없이 여는 화면은 로그인·법적 고지·보기 전용 링크·초대 수락뿐.
- **MUST NOT** 사용자 데이터를 홈 서버 외의 곳으로 전송하지 않는다. 외부 API(지도·장소)는 ADR-0004 범위에서만.
- **MUST NOT** 사용자 위치(좌표)를 서버에 저장하거나 로그로 남기지 않는다.
- **MUST** 서버의 모든 데이터 접근은 인증(`requireUser`) + 여행 멤버십 인가를 거친다. 인가 누락 테스트를 함께 작성한다.
- **MUST NOT** 비밀값(OAuth 시크릿, 서버 API 키, 세션 키)을 커밋하거나 웹앱 번들에 포함하지 않는다. 브라우저 키는 도메인 제한 필수.
- **MUST** Google 장소 데이터는 Google 지도/리스트에만 표시하고, 평점·리뷰는 저장하지 않는다 (`docs/10-maps-places.md` §2.1).
- 보안 상세 체크리스트: `docs/09-server-auth-security.md` §7
- **MUST NOT** 애널리틱스/트래커/광고 SDK 추가 금지 (별도 ADR 없이는).
- **MUST** 모든 DB 접근은 repository를 통해서만 (웹: `apps/web/src/data/repositories/*`, 서버: `apps/server/src/repositories/*`). 컴포넌트/라우트 핸들러에서 DB 직접 호출 금지.
- **MUST** 웹·서버가 공유하는 타입/Zod 스키마는 `packages/shared`에만 정의한다.
- **MUST** 스키마 변경 시 Dexie 버전을 올리고 마이그레이션 + 마이그레이션 테스트를 함께 작성한다.
- **MUST** 백업 JSON 포맷(`schemaVersion`)은 하위 호환을 유지한다. 구버전 백업은 항상 가져올 수 있어야 한다.
- **MUST** 모든 사용자 노출 문자열은 i18n 키로 (`src/i18n/`). 하드코딩 금지.
- **MUST** 문구는 한 줄 = 한 문장: 문장 사이는 줄바꿈(`
`), 줄 끝 마침표 없음, 휴대폰 한 줄(약 22자) 안쪽으로 짧게 (2026-10-25 사용자 요청, `i18n/copy.test.ts`가 검사).
- **MUST** 모바일(360px 폭) 기준으로 먼저 구현하고 확인한다.
- **MUST** TypeScript `strict`. `any` 금지 (불가피하면 `// reason:` 주석).
- **MUST NOT** 새 의존성 추가 전 사용자에게 묻는다 (번들 크기 & 오프라인 영향).
- **MUST** 모든 기능은 **무료로 만드는 방법을 먼저 찾는다**. 무료 방법이 없거나 무료 사용량을 넘으면 과금되는 경우, 구현 전에 비용·대안을 사용자에게 알리고 결정을 받는다. 기능을 바꾸거나 빼는 결정은 사용자가 한다 (2026-10-22 사용자 요청, `docs/08-open-decisions.md` L 그룹).
- **MUST** 코드·번들은 최대한 작게 (2026-10-22 사용자 요청). 라이브러리는 꼭 필요할 때만, 가벼운 대안 우선(예: `zod/mini`), 무거운 화면·기능은 라우트 단위 지연 로딩. 단계 완료 보고에 `pnpm size`의 **첫 화면 합계**(gzip, 진입 파일 + 함께 불러오는 파일)를 적는다. 예산 300KB (2026-10-24 200 → 300KB, 사용자 결정). 시트처럼 열 때만 필요한 부품은 `shared/ui/BottomSheet.tsx`처럼 처음 열 때 불러오고 한가할 때 미리 받는다.
- **MUST NOT** 가계부(지출 기록·예산·정산) 기능은 범위에서 제외됨 (2026-10-22 사용자 결정). 환율은 **조회·계산 도구로만** 제공하고 금액을 저장하지 않는다 (`docs/12-quick-menu-settings-fx.md`).
- **MUST** 서버의 외부 API 호출은 `services/apiUsage.ts`의 `guardApi`·`trackApi`를 거친다 (관리자 API 사용량·자동 중지). 새 API는 `APIS`에 과금 가능 여부·무료 사용량과 함께 등록 (`docs/code-map.md` §3).
- **MUST** 새 실험 기능은 먼저 실험실(`data/labsStore.ts`)에 넣어 켜고 끌 수 있게 한다 (사용자 요청 2026-10-24).
- **MUST** AI 추천은 근거(원문 id)가 있는 장소만 보여준다. AI 입력에 좌표·사용자 정보를 넣지 않는다 (`docs/14-ai-recommendations.md` §5, §8).
- **MUST** 설정 UI는 `docs/12-quick-menu-settings-fx.md` §3.1 컨트롤 선택 원칙을 따른다 (즉시 적용, 저장 버튼 없음).

## 4. 코드 스타일 요약

상세: `docs/conventions/coding-rules.md`

- 함수형 컴포넌트 + hooks. 파일당 컴포넌트 1개.
- 기능(feature) 단위 폴더 구조. 레이어 의존 방향: `app → features → shared/data/domain` (역방향 금지). `packages/shared`는 어떤 앱도 import 하지 않는다.
- 도메인 로직(날짜 계산, 정렬, 거리 계산 등)은 `domain/`(웹·서버 공용이면 `packages/shared`)에 **순수 함수**로, React 의존 없이 작성하고 단위 테스트한다.
- 날짜/시간: 문자열 `YYYY-MM-DD`(로컬 날짜) / `HH:mm` + IANA 타임존. `Date` 객체를 DB에 저장하지 않는다.

## 5. 작업 방식

- 큰 작업은 먼저 계획을 짧게 제시하고 확인받은 뒤 진행.
- 한 커밋 = 한 논리적 변경. 커밋 메시지는 Conventional Commits (`docs/conventions/git-workflow.md`).
- 기능 추가 시 테스트 동반: 도메인 로직은 Vitest, 핵심 사용자 흐름은 Playwright.
- 완료 보고 시 `pnpm check` 결과를 함께 보고한다.
- 결정이 생기면 `docs/adr/`에 ADR 추가, `docs/08-open-decisions.md`에서 해당 항목을 '확정'으로 옮긴다.

## 6. 커뮤니케이션

- 사용자와는 한국어로 대화한다. 코드 식별자·커밋 메시지는 영어, 주석/문서는 한국어 허용.
