# 22. 반복 작업 목록 (매달 1회)

> 2026-10-25 사용자 요청: "주기적으로 업데이트가 필요한 항목을 정리해서 한 달에 한 번씩 업데이트".
> 매달 Claude 정기 작업(클라우드 루틴)이 이 목록을 따라 확인·수정하고 **PR(변경 제안)**을 연다 — 사용자가 확인·병합해야 배포된다.
> 등록된 정기 작업: "트립포켓 월간 정보 갱신" (claude.ai 루틴, 매달 1일 10:17 KST, id trig_01XGzTbcm8KuLY8B3pzG9GFj, 2026-10-26 등록) — 저장소 접근이 안 되면 claude.ai에서 GitHub 연결 확인.
> 사람이 직접 해도 같은 순서. 각 항목에 "어디를 고치나"를 적었다.
> **관리자 앱 안내 (2026-10-27)**: 관리자에게만 한 달에 한 번 무작위 날짜에 "월간 갱신 요청문" 팝업이 뜬다 (마이 → 관리자에서도 열림). [요청문 복사] → Claude에게 붙여 넣으면 이 목록대로 확인한다. 요청문 원문: `apps/web/src/features/me/monthlyUpdate.ko.ts` — **이 문서에 항목을 더하면 거기에도 더한다**.

## A. 데이터 (앱에 담긴 정보 — 바뀌면 사용자에게 틀린 안내가 된다)

| # | 무엇 | 어디 | 확인할 곳 |
|---|---|---|---|
| A1 | **나라별 입국 필수 항목** (비자·무비자 기간·입국신고·전자여행허가 요금·여권 기준) 20개국 | `packages/shared/src/data/essentials.ts` (`ESSENTIALS_CHECKED_AT`도 갱신) | 각 나라 공식 사이트·주재 한국 공관·외교부 해외안전여행(0404.go.kr) |
| A2 | **나라별 이벤트·혜택** — 새 이벤트 추가, 끝난 것 정리 (예: 대만 여행 지원금, 마카오 무료 버스) | 같은 파일 `TRAVEL_EVENTS` | 각국 관광청 공식 사이트 |
| A3 | **공휴일** — 다음 해 태국·말레이시아 (앱에 담는 나라), 대만 TaiwanCalendar 다음 해 파일, 한국 임시·대체공휴일 | `apps/web/src/data/holidays/*.json` (`scripts/gen-holidays.mjs`), `data/services/travelInfo.ts` | Google 캘린더 공휴일 피드, TaiwanCalendar 저장소, Nager.Date |
| A4 | **공항 목록** — 새 공항·터미널 | `packages/shared/src/data/airports.ts` | 공항 공식 사이트 |
| A5 | **환율 보조 출처·통화** 동작 확인 | `apps/web/src/data/services/fxService.ts` | 앱 환율 화면 |
| A6 | **긴급 연락처** — 나라별 경찰·구급, 영사안전콜센터 (`EMERGENCY_CHECKED_AT`) | `packages/shared/src/data/emergency.ts` | 각국 정부·공관 공식 안내 |
| A7 | **법적 고지·데이터 출처** — 쓰는 서비스와 맞는지, 오픈소스 목록 | `apps/web/src/features/legal/content.ko.ts`, `licenses.json` | 실제 코드에서 부르는 서비스 |
| A8 | **여행지 특보** — 나라별 특보 링크, 새로 약관이 허락된 나라, 일본 기상청 새 코드표 공개 여부 | `packages/shared/src/alerts/alerts.ts`, 서버 `services/nationalAlerts.ts`, docs/24 §7 | 각 나라 기상청 |
| A9 | **도움말·소개 카드**가 지금 화면과 맞는지 | `features/me/IntroCarousel.tsx`, `legal/content.ko.ts` HELP | 앱 화면 |

## B. 무료 사용량·요금 (과금 방지 — CLAUDE.md 무료 우선)

| # | 무엇 | 어디 |
|---|---|---|
| B1 | 외부 API **무료 한도·요금 변경** (Google 지도·장소·Routes, 카카오, 네이버 지도·검색(API HUB 한시적 무료), Geoapify, Gemini·Workers AI·Groq, 수출입은행, AviationStack, Open-Meteo, OpenFreeMap, Overpass, 공공데이터포털, GDACS·USGS·기상청들, 웹 푸시) + 기반 서비스(Cloudflare Pages·Functions, Tailscale Funnel, GitHub Actions) | `apps/server/src/services/apiUsage.ts` `APIS` + `docs/code-map.md` §3 표 |
| B2 | 유료 서비스 가격 (참고 문서) | `docs/21-paid-services.md` |
| B3 | 관리자 **API 사용량** 화면에서 남은 무료량 20% 아래(주황·빨강)였던 API 점검 — 자동 중지는 95% | 앱 → 마이 → 관리자 → API 사용량 |
| B5 | **API 주소·버전 폐기 공지** (수출입은행 도메인 2026-04·일본 기상청 경보 데이터 2026-05에 실제로 바뀜) | 서버 `services/*.ts`, 웹 `shared/maps/*` |
| B6 | **AI 모델 폐기·교체** (Gemini·Workers AI·Groq 기본 모델) | `apps/server/src/config.ts` `*_MODEL` |
| B4 | API 키 유효기간 — 공공데이터포털 활용기간(보통 2년, 한 달 전 연장신청)·Cloudflare 토큰 만료·Google 결제 카드 만료·Google 로그인 6개월 미사용 삭제 | `apps/server/.env` 각 키 위 [유효기간] |

## C. 보안·의존성

| # | 무엇 | 어떻게 |
|---|---|---|
| C1 | 라이브러리 보안 알림 | `pnpm audit --prod` — 심각(high 이상)만 고치기, 새 메이저 버전은 사용자에게 묻기. `pnpm outdated`는 목록만 보고 |
| C2 | Node·브라우저 지원 확인 | `pnpm check`, `pnpm e2e` |
| C3 | 로그인 앱 키·지도 키 도메인 제한 확인 (Google·카카오·네이버 콘솔) | 사람이 직접 (키 값은 채팅·PR에 쓰지 않기) |
| C4 | 도메인 `trippocket.day` 갱신일·자동 갱신 결제 수단 | 사람이 직접 (도메인 등록 업체 화면) |

## D. 서버 PC (사람이 직접 — 클라우드 루틴은 이 PC에 못 들어옴)

| # | 무엇 | 어떻게 |
|---|---|---|
| D1 | 백업 파일이 매일 생기는지 | `E:\TripPocketBackup` 최근 날짜 확인 |
| D2 | 복구 리허설 (분기 1회) | `ops/README.md` §3 |
| D3 | 디스크·문서 용량 | `pnpm admin:data list` (apps/server) |
| D4 | Windows 업데이트 후 서버 자동 시작 | 바탕화면 "TripPocket 서버 재시작.bat" |

## E. 콘텐츠 품질

| # | 무엇 | 어디 |
|---|---|---|
| E1 | 신고·숨김된 후기 확인 | 관리자 후기 API (`/api/admin/reviews`) |
| E2 | 개선 제안 읽고 답하기 | 마이 → 관리자 → 개선 제안 |
| E3 | 문구 규칙 (한 줄 = 한 문장) | `pnpm --filter @trippocket/web test` (copy.test.ts) |
| E4 | 실험실 기능 중 정식으로 넣거나 뺄 것 | 마이 → 실험실 (`data/labsStore.ts`) |

## 정기 작업이 하는 일 (A·B·C1·C2·E3)

1. 이 문서의 A·B 항목을 공식 출처로 다시 확인 (웹 검색)
2. 바뀐 것만 고침 + `checkedAt`/`ESSENTIALS_CHECKED_AT`을 그날로
3. `pnpm install && pnpm check` 통과 확인
4. 브랜치 `chore/monthly-YYYY-MM`에 커밋, PR 열기 — 본문에 바뀐 것·출처 링크·확인 못 한 것
5. **main에 바로 넣지 않는다** (자동 배포되므로 사용자 확인 후)
