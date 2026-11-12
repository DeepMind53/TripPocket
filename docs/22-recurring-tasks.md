# 22. 반복 작업 목록 (매달 1회)

> 2026-10-25 사용자 요청: "주기적으로 업데이트가 필요한 항목을 정리해서 한 달에 한 번씩 업데이트".
> 매달 Claude 정기 작업(클라우드 루틴)이 이 목록을 따라 확인·수정하고 **PR(변경 제안)**을 연다 — 사용자가 확인·병합해야 배포된다.
> 등록된 정기 작업: "트립포켓 월간 정보 갱신" (claude.ai 루틴, 매달 1일 10:17 KST, id trig_01XGzTbcm8KuLY8B3pzG9GFj, 2026-10-26 등록) — 저장소 접근이 안 되면 claude.ai에서 GitHub 연결 확인.
> 사람이 직접 해도 같은 순서. 각 항목에 "어디를 고치나"를 적었다.
> **관리자 앱 안내 (2026-10-27)**: 관리자에게만 한 달에 한 번 무작위 날짜에 "월간 갱신 요청문" 팝업이 뜬다 (마이 → 관리자에서도 열림). [요청문 복사] → Claude에게 붙여 넣으면 이 목록대로 확인한다. 요청문 원문: `apps/web/src/features/me/monthlyUpdate.ko.ts` — **이 문서에 항목을 더하면 거기에도 같은 번호로 더한다**.
> **2026-11-12 다시 정리**: 주제별 A~H로 묶고 번호를 차례대로. 새로 넣은 것: C1 숙소 최저가 링크, C4 영수증·사진 글자 인식, D1에 Vision·Azure·SerpApi·아고다, D3 Azure 종료 예정, E1 서비스 대조, G 문서 현행화, H Google 콘솔 할당량.

## A. 출국·안전 정보 (틀리면 여행자가 곤란해진다)

| # | 무엇 | 어디 | 확인할 곳 |
|---|---|---|---|
| A1 | **나라별 입국 필수 항목** (비자·무비자 기간·입국신고·전자여행허가 요금·여권 기준) 20개국 | `packages/shared/src/data/essentials.ts` (`ESSENTIALS_CHECKED_AT`) | 각 나라 공식 사이트·주재 한국 공관·외교부 해외안전여행(0404.go.kr) |
| A2 | **나라별 이벤트·혜택** — 새 이벤트 추가, 끝난 것 정리 | 같은 파일 `TRAVEL_EVENTS` | 각국 관광청 공식 사이트 |
| A3 | **전자여행허가** — ETIAS 시행일, ETA-IL, JESTA, 새로 생긴 나라 | `packages/shared/src/data/health.ts` `ENTRY_PERMITS`·`PERMIT_FOR_COUNTRY`, `essentials.ts` | 각국 공식 신청 사이트 |
| A4 | **긴급 연락처** — 나라별 경찰·구급, 영사안전콜센터 (`EMERGENCY_CHECKED_AT`), 빠진 6곳 | `packages/shared/src/data/emergency.ts` | 각국 정부·공관 공식 안내 |
| A5 | **여행지 특보** — 나라별 특보 링크, 새로 약관이 허락된 나라, 일본 기상청 새 코드표 | `packages/shared/src/alerts/alerts.ts`, 서버 `services/nationalAlerts.ts`, docs/24 §7 | 각 나라 기상청 |

## B. 이동·현지 정보

| # | 무엇 | 어디 | 확인할 곳 |
|---|---|---|---|
| B1 | **공항 목록·터미널** | `packages/shared/src/data/airports.ts` | 공항 공식 사이트 |
| B2 | **국내 공항 정보 API** — 인천·한국공항공사 주소·응답 항목·대상 공항 | 서버 `services/airportInfo.ts` | 공공데이터포털 |
| B3 | **항공사 수하물 대표값** (`BAGGAGE_CHECKED_AT`) — `official: false` 확인, 인천 취항 항공사 추가 | `packages/shared/src/data/baggage.ts` | 항공사 공식 페이지 |
| B4 | **항공사 회원 등급 이름** (`AIRLINE_TIERS_CHECKED_AT`) | `packages/shared/src/data/airlineTiers.ts` | 항공사 회원 프로그램 |
| B5 | **나라별 철도·지하철·버스 이름** (예약 칩, `TRANSIT_CHECKED_AT`) | `packages/shared/src/data/transit.ts` | 운영사 공식 사이트 |
| B6 | **국내 기차역·버스 터미널** (`KR_STATIONS_CHECKED_AT`) — 새 역·폐지, SRT·KTX 정차역, 터미널 이전 | `apps/web/src/data/krStations.ts` | 코레일·SR·고속버스 통합예매 |
| B7 | **현지 정보 — 교통카드·결제 팁** (`TRANSIT_CARDS_CHECKED_AT`): 카드 이름·충전, 결제 방식, 카드 사진·공식 링크 (사진 없는 카드는 위키미디어 공용 자유 이용 사진 360px + 작가·라이선스) | `apps/web/src/i18n/ko.json` `localInfo.transit`·`localInfo.pay`, `apps/web/src/data/transitCards.ts`, `apps/web/public/transit/` | 교통 운영사, commons.wikimedia.org |
| B8 | **도시별 현지 생활 정보** (`CITY_LOCAL_CHECKED_AT`) — 계속 확대 | `apps/web/src/data/cityLocal.ts`·`cityLocal2.ts` | 운영사·관광청 |
| B9 | **대중교통 안내** (`TRANSIT_GUIDE_CHECKED_AT`) — 요금·환승·앱, "곧 바뀜" 날짜 지남 | `apps/web/src/data/transitGuide.ts` | 운영사 공식 사이트 |
| B10 | **공휴일** — 다음 해 태국·말레이시아, 대만 TaiwanCalendar 다음 해, 한국 임시·대체공휴일 | `apps/web/src/data/holidays/*.json` (`scripts/gen-holidays.mjs`), `data/services/travelInfo.ts` | Google 캘린더 공휴일 피드, TaiwanCalendar, Nager.Date |

## C. 앱 기능에 쓰는 외부 정보

| # | 무엇 | 어디 |
|---|---|---|
| C1 | **숙소 최저가 링크** (docs/28) — 아고다 경로 값(CID)·카드사·항공사 할인 페이지가 열리고 할인이 이어지는지, 예약 앱 6곳 검색 주소 형식 | `apps/web/src/domain/agodaRoutes.ts`, `domain/lodgingLinks.ts` |
| C2 | **환율 보조 출처** 동작 (currency-api 두 주소·Frankfurter) | `apps/web/src/data/services/fxService.ts` |
| C3 | **회화·택시 카드·건강 카드 번역** — 어색한 문장 | `packages/shared/src/data/phrases.ts`, `health.ts` |
| C4 | **영수증·사진 글자 인식** (ADR-0012) — 한국·일본·영어 영수증 2~3장이 품목 표로 나오는지, 안 맞는 모양은 시험에 더하고 고치기, Tesseract 언어 파일 주소 | 서버 `services/ocrRows.ts`(줄 묶기), 웹 `domain/receipt.ts`(+`receipt.test.ts`), `data/services/deviceOcr.ts` |
| C5 | **AI 추천 결과 품질** — 성수역·서면역·신주쿠역·타이베이역·숙소 기준 0곳인지 | 앱 AI 추천 화면 |
| C6 | **도움말·소개 카드** — 문구·버튼 이름·순서가 지금 화면과 맞는지 (그림은 실제 부품으로 그림) | `features/me/IntroCarousel.tsx`, `legal/content.ko.ts` `HELP` |

## D. 무료 사용량·요금 (과금 방지 — CLAUDE.md 무료 우선)

| # | 무엇 | 어디 |
|---|---|---|
| D1 | 외부 API **무료 한도·요금 변경** — 과금 가능(Google 지도·장소·Routes·Vision, 카카오, 네이버 지도·검색), 무료(Geoapify, Gemini·Workers AI·Groq, Azure Read F0, 수출입은행, AviationStack, SerpApi, AirLabs, 공공데이터포털, Open-Meteo, OpenFreeMap, Overpass, 위키백과, Frankfurter, 기상청들, 웹 푸시), 스스로 정한 한도(아고다 하루 100), 기반 서비스(Cloudflare Pages·Functions, Tailscale Funnel, GitHub Actions) | 서버 `services/apiUsage.ts` `APIS` + `docs/code-map.md` §3 표 |
| D2 | 한도가 끝났을 때 **대체 API·대체 기능** 동작 | `docs/23-paid-api-fallbacks.md` |
| D3 | **API 주소·버전 폐기 공지** (수출입은행 도메인 2026-04·일본 기상청 2026-05에 실제로 바뀜), Azure Image Analysis 4.0 종료 2028-09-25 | 서버 `services/*.ts`, 웹 `shared/maps/*` |
| D4 | **AI 모델 폐기·교체** (Gemini·Workers AI·Groq 기본 모델) | 서버 `config.ts` `*_MODEL` |
| D5 | API **키 유효기간** — 공공데이터포털 활용기간(보통 2년, 한 달 전 연장신청)·Cloudflare 토큰·Google 결제 카드·Google 로그인 6개월 미사용 삭제 | `apps/server/.env` 각 키 위 [유효기간] |
| D6 | 유료 서비스 가격 (참고 문서) | `docs/21-paid-services.md` |

> 사용량 측정이 빠지지 않게 하는 자동 검사 (`apps/server/test/apiUsage.test.ts`): 서버의 모든 `fetch(`는 바로 앞에서 `guardApi`·`trackApi`를 거쳐야 하고, 웹 `data/api/usage.ts`의 `BrowserApi`와 서버 `APIS`의 `browser` 항목이 같아야 한다. 새 API를 넣으면 `APIS`에 등록하고 이 검사를 통과시킨다.

## E. 법적 고지·출처

| # | 무엇 | 어디 |
|---|---|---|
| E1 | 개인정보처리방침·이용약관·데이터 출처가 쓰는 서비스와 맞는지 — `APIS`의 외부 서비스가 방침 3절과 `DATA_SOURCES`에 모두 있는지 | `apps/web/src/features/legal/content.ko.ts` |
| E2 | 오픈소스 라이선스 목록 | `node apps/web/scripts/gen-licenses.mjs` → `licenses.json` |

## F. 보안·품질

| # | 무엇 | 어떻게 |
|---|---|---|
| F1 | 라이브러리 보안 알림 | `pnpm audit --prod` — 심각(high 이상)만 고치기, 새 메이저 버전은 사용자에게 묻기. `pnpm outdated`는 목록만 보고 |
| F2 | Node·브라우저 지원 확인 | `pnpm check`, `pnpm e2e` |
| F3 | 문구 규칙 (한 줄 = 한 문장) | `copy.test.ts` (`pnpm check`에 포함) |

## G. 문서 현행화

| # | 무엇 | 어디 |
|---|---|---|
| G1 | "현재"·"다음에 할 일"이 지난 달 커밋과 맞는지 (끝난 일은 기록으로, 결정 대기는 docs/08로) | `PROGRESS.md` |
| G2 | 실제 폴더·라우트·서버 서비스와 맞는지 | `docs/code-map.md`, `docs/03-architecture.md` |
| G3 | 문서 목록의 상태(현행·기록·보류) | `docs/README.md` |

## H. 사람이 직접 (클라우드 루틴은 서버 PC·콘솔에 못 들어감 — 결과 보고 끝에 체크리스트로)

| # | 무엇 | 어떻게 |
|---|---|---|
| H1 | 백업 파일이 매일 생기는지 | `E:\TripPocketBackup` (서버 `.env`의 `BACKUP_DIRS`, OneDrive에도) 최근 날짜 |
| H2 | 복구 리허설 (분기 1회: 1·4·7·10월) | `ops/README.md` §3 |
| H3 | 디스크·문서 용량 | `pnpm admin:data list` (apps/server) |
| H4 | Windows 업데이트 후 서버 자동 시작 | 바탕화면 "TripPocket 서버 재시작.bat" |
| H5 | 로그인 앱 키·지도 키 도메인 제한 (Google·카카오 콘솔) | 키 값은 채팅·PR에 쓰지 않기 |
| H6 | **Google Cloud 콘솔 하루 할당량 상한** (지도·장소·Routes·Vision) — 서버가 꺼져 사용량을 못 셀 때의 마지막 안전장치 | Google Cloud 콘솔 → 할당량 |
| H7 | 도메인 `trippocket.day` 갱신일·자동 갱신 결제 수단 | 도메인 등록 업체 |
| H8 | API 사용량 화면에서 남은 무료량 20% 아래(주황·빨강)였던 API — 자동 중지는 95% | 마이 → 관리자 → API 사용량 |
| H9 | 공공데이터포털 개발계정 활용기간, Google 결제 카드·Cloudflare 토큰 만료, Google 로그인 6개월 미사용 | 각 콘솔 |
| H10 | 숨긴 후기, 개선 제안 답장 | `/api/admin/reviews`, 마이 → 관리자 → 개선 제안 |
| H11 | 실험실 기능 중 정식으로 넣거나 뺄 것 | 마이 → 실험실 (`data/labsStore.ts`) |

## 정기 작업이 하는 일 (A~G)

1. A~E 항목을 공식 출처로 다시 확인 (웹 검색)
2. 바뀐 것만 고침 + 확인 날짜 상수를 그날로
3. G 문서 현행화
4. `pnpm install && pnpm check` 통과 확인
5. 브랜치 `chore/monthly-YYYY-MM`에 커밋, PR 열기 — 본문에 바뀐 것·출처 링크·확인 못 한 것, H 체크리스트
6. **main에 바로 넣지 않는다** (자동 배포되므로 사용자 확인 후)
