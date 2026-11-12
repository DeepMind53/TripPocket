import {
  AIRLINE_TIERS_CHECKED_AT,
  BAGGAGE_CHECKED_AT,
  EMERGENCY_CHECKED_AT,
  ESSENTIALS_CHECKED_AT,
  TRANSIT_CHECKED_AT,
} from '@trippocket/shared';
import { TRANSIT_CARDS_CHECKED_AT } from '../../data/transitCards';
import { TRANSIT_GUIDE_CHECKED_AT } from '../../data/transitGuide';
import { CITY_LOCAL, CITY_LOCAL_CHECKED_AT } from '../../data/cityLocal';
import { KR_STATIONS_CHECKED_AT } from '../../data/krStations';

/**
 * 관리자 월간 갱신 요청문 (사용자 요청 2026-10-27): 팝업에서 [복사]해 Claude에게 그대로 붙여 넣는 글.
 * 긴 글이라 i18n 키 대신 이 파일에 둔다 (법적 고지와 같은 방식). 목록 근거: docs/22-recurring-tasks.md.
 * 새로 주기적 확인이 필요한 정보를 앱에 넣으면 여기와 docs/22에 함께 더한다 (번호는 docs/22 표와 같게).
 * 2026-11-12 다시 정리: 주제별로 묶고 번호를 차례대로, 숙소 최저가·영수증·사진 인식·문서 현행화 추가
 */
export function monthlyUpdateRequest(month: string): string {
  return `트립포켓 ${month} 월간 정보 갱신을 해 줘. (D:\\Travel_Planner, docs/22-recurring-tasks.md 기준)

[0. 시작 전에 — 이 요청문 점검]
- 지난 갱신 이후 커밋(git log)과 docs/22를 보고, 주기적으로 확인해야 할 정보가 새로 생겼는데 아래에 없으면
  이 요청문(apps/web/src/features/me/monthlyUpdate.ko.ts)과 docs/22에 같은 번호로 추가해 줘
- 아래 문구 중 사실과 다르거나 파일 위치·이름이 바뀐 곳이 있으면 고쳐서 반영하고, 고친 내용을 보고해 줘

모든 항목은 공식 출처(정부·공관·관광청·운영사·서비스 공식 문서)로 다시 확인하고, 바뀐 것만 고쳐 줘.
확인한 항목은 확인 날짜(*_CHECKED_AT·checkedAt)를 오늘로 바꾸고, 확인하지 못한 것은 그대로 두고 보고해 줘.

[A. 출국·안전 정보 — 틀리면 여행자가 곤란해진다]
A1. 나라별 입국 필수 항목 (비자·무비자 기간·입국신고·전자여행허가 요금·여권 기준, 20개국)
    - packages/shared/src/data/essentials.ts (지난 확인: ${ESSENTIALS_CHECKED_AT})
A2. 나라별 이벤트·혜택: 끝난 것은 빼고, 새로 생긴 공식 이벤트는 더하기 — 같은 파일 TRAVEL_EVENTS (각 checkedAt)
A3. 전자여행허가: 유럽 ETIAS 시행일, 이스라엘 ETA-IL(미확인), 일본 JESTA, 새로 생긴 나라
    - packages/shared/src/data/health.ts ENTRY_PERMITS·PERMIT_FOR_COUNTRY, essentials.ts
A4. 긴급 연락처: 나라별 경찰·구급, 외교부 영사안전콜센터 — packages/shared/src/data/emergency.ts (지난 확인: ${EMERGENCY_CHECKED_AT})
    - 아직 못 넣은 나라(호주·캐나다·말레이시아·마카오·괌·사이판)도 공식 출처가 확인되면 추가
A5. 여행지 특보: 나라별 기상청 특보 링크가 열리는지, 새로 약관이 허락된 나라가 있는지
    - packages/shared/src/alerts/alerts.ts, docs/24 §7
    - 일본 기상청 새 경보 코드표(2026-05 개편) 공개 여부 → 공개되면 이름 없는 코드 채우기 (apps/server/src/services/nationalAlerts.ts JMA_CODE)

[B. 이동·현지 정보]
B1. 공항 목록·터미널: packages/shared/src/data/airports.ts
B2. 국내 공항 정보 API: 인천(B551177 statusOfAllFltDeOdp, 터미널 코드 P01·P02·P03),
    한국공항공사(B551178 flight-search) 주소·응답 항목·대상 공항 14곳 (apps/server/src/services/airportInfo.ts)
B3. 항공사 수하물 대표값: packages/shared/src/data/baggage.ts (지난 확인: ${BAGGAGE_CHECKED_AT})
    - official: false인 항공사는 공식 페이지로 확인해 true로, 인천 취항 항공사를 차례로 더하기
B4. 항공사 회원 등급 이름: packages/shared/src/data/airlineTiers.ts (지난 확인: ${AIRLINE_TIERS_CHECKED_AT})
    - AIRLINE_TIERS_VERIFIED에 없는 프로그램을 공식 사이트로 확인
B5. 나라별 철도·지하철·버스 이름 (예약 칩): packages/shared/src/data/transit.ts (지난 확인: ${TRANSIT_CHECKED_AT})
B6. 국내 기차역·버스 터미널: apps/web/src/data/krStations.ts (지난 확인: ${KR_STATIONS_CHECKED_AT})
    - 새 역·폐지 역, SRT·KTX-이음 정차역 변경(코레일·SR 공식 안내), 고속·시외버스 터미널 이전·이름 변경
B7. 빠른 메뉴 "현지 정보" — 교통카드·결제 팁 (지난 확인: ${TRANSIT_CARDS_CHECKED_AT})
    - 교통카드 문구: apps/web/src/i18n/ko.json localInfo.transit (나라별 카드 이름·충전 방법, 새 결제 방식)
    - 결제 팁 문구: 같은 파일 localInfo.pay (현금·카드·QR 결제, 팁 문화가 바뀌었는지)
    - 카드·승차권·토큰 사진과 공식 링크: apps/web/src/data/transitCards.ts (+ apps/web/public/transit/)
      · 공식 링크가 열리는지, 카드 디자인이 바뀌었거나 없어진 승차권·토큰이 있는지
      · 그린 카드(사진 없음)는 위키미디어 공용에서 자유 이용(CC0·CC BY·CC BY-SA·퍼블릭 도메인) 사진을 찾아
        360px로 줄여 넣고 작가·라이선스·원본 주소를 함께 적기 (상표 로고만 있는 그림은 쓰지 않기)
B8. 도시별 현지 생활 정보: apps/web/src/data/cityLocal.ts·cityLocal2.ts (지난 확인: ${CITY_LOCAL_CHECKED_AT}, 지금 ${CITY_LOCAL.length}곳)
    - 도시마다 교통카드·결제·교통수단·요금·환승·앱 확인, 한국인이 많이 찾는 도시를 계속 더하기 (겹치지 않게, 요금은 확인한 것만)
B9. 대중교통 안내: apps/web/src/data/transitGuide.ts (지난 확인: ${TRANSIT_GUIDE_CHECKED_AT})
    - 나라별 교통수단·대표 도시 기본요금·환승 규칙·추천 앱·공식 링크 — 요금 인상·새 노선·없어진 앱
    - note에 적은 "곧 바뀜"(예: 스타페리 2027-01, 멜버른 반값 2027-01-01, 취리히 2026-12-13)이 지났으면 고치기
B10. 공휴일
    - 다음 해 태국·말레이시아 데이터 (scripts/gen-holidays.mjs → apps/web/src/data/holidays)
    - 대만: TaiwanCalendar에 다음 해 파일이 올라왔는지 (apps/web/src/data/services/travelInfo.ts)
    - 한국 임시공휴일·대체공휴일이 새로 정해졌는지 (Nager.Date 반영 여부)

[C. 앱 기능에 쓰는 외부 정보]
C1. 숙소 최저가 링크 (docs/28): apps/web/src/domain/agodaRoutes.ts (경로 21곳·할인 안내 14곳), domain/lodgingLinks.ts (예약 앱 6곳)
    - 아고다 경로 값(CID)·카드사·항공사 할인 페이지가 아직 열리고 할인이 이어지는지, 끝난 행사는 빼기
    - 여기어때·놀·트립닷컴·부킹닷컴·구글 호텔 검색 주소 형식이 바뀌지 않았는지
C2. 환율 보조 출처 동작 (apps/web/src/data/services/fxService.ts — currency-api 두 주소·Frankfurter)
C3. 여행 회화·택시 카드 문구 (packages/shared/src/data/phrases.ts), 건강 카드 번역(알레르기 23종·12개 언어, health.ts) — 어색한 곳
C4. 영수증·사진 글자 인식 (ADR-0012): 영수증 사진 2~3장(한국·일본·영어)을 [영수증 분석]해 품목이 표로 나오는지
    - 서버 줄 묶기 apps/server/src/services/ocrRows.ts, 품목 읽기 apps/web/src/domain/receipt.ts
    - 안 맞는 영수증 모양이 있으면 receipt.test.ts에 그 모양을 더하고 고치기
    - 기기 안 인식(Tesseract) 언어 파일 주소(jsDelivr tessdata)가 열리는지
C5. AI 추천 결과 품질: 성수역·서면역·신주쿠역·타이베이역·숙소 기준으로 0곳이 나오는지
C6. 도움말·소개 카드 그림이 지금 화면·기능과 맞는지 (features/me/IntroCarousel.tsx, legal/content.ko.ts HELP)
    - 소개 그림은 실제 부품(노선·탑승권·다음 역 카드·도장)으로 그리니 문구·버튼 이름·순서만 대조

[D. 무료 사용량·요금 — 과금 방지]
D1. 외부 API 무료 한도·요금 변경 — apps/server/src/services/apiUsage.ts APIS + docs/code-map.md §3 표를 함께 고치기
    - 과금 가능: Google 지도·장소·Routes·Cloud Vision(글자·장소·분류 기능마다 월 1,000), 카카오, 네이버 지도·검색(API HUB 한시적 무료가 끝나는지)
    - 무료(넘으면 막힘): Geoapify, Gemini·Workers AI·Groq, Azure AI Vision Read F0(월 5,000), 수출입은행, AviationStack(월 100),
      SerpApi(월 250), AirLabs(월 1,000), 공공데이터포털(외교부·기상청·인천공항·한국공항공사·TourAPI·에어코리아 — 개발계정, 사용자가 늘면 운영계정),
      Open-Meteo, OpenFreeMap, Overpass, 위키백과, Frankfurter, GDACS·USGS·일본·미국·대만·캐나다 기상청, 웹 푸시
    - 스스로 정한 한도: 아고다 숙소 찾기 하루 100 (사이트 구조가 바뀌어 찾기가 실패하는지도)
    - 무료로 쓰는 기반 서비스: Cloudflare Pages·Functions(하루 10만 요청), Tailscale Funnel, GitHub Actions
D2. 한도가 끝났을 때 대체 API·대체 기능이 아직 맞게 동작하는지 (docs/23-paid-api-fallbacks.md)
D3. API 주소·버전 폐기 공지 (전에 실제로 바뀐 적 있음: 수출입은행 도메인 2026-04, 일본 기상청 경보 데이터 2026-05)
    - 공공데이터포털 TravelAlarmService2·SptravelWarningServiceV2·WthrWrnInfoService, 대만 W-C0033-001,
      네이버 지도 v3, Google Maps JS·Places(New)·Routes·Vision, 카카오 로컬, Geoapify, AviationStack, SerpApi
    - Azure Image Analysis 4.0 종료 예정 2028-09-25 (APIS retires) — 1년 전부터 대체 읽기 서비스 준비
D4. AI 모델 이름이 폐기·교체 예정인지 (Gemini·Workers AI·Groq 기본 모델 — apps/server/src/config.ts *_MODEL)
D5. API 키 유효기간: apps/server/.env 각 키 위 [유효기간] 안내를 다시 확인
    - 값은 출력하지 말고, 유효기간 정책이 바뀐 서비스만 알려 줘
D6. 유료 서비스 가격 참고 문서: docs/21-paid-services.md

[E. 법적 고지·출처]
E1. 개인정보처리방침·이용약관·데이터 출처가 지금 쓰는 서비스와 맞는지 (apps/web/src/features/legal/content.ko.ts)
    - APIS에 있는 외부 서비스가 개인정보처리방침 3절과 DATA_SOURCES에 모두 있는지 대조
E2. 오픈소스 라이선스 목록 갱신 (node apps/web/scripts/gen-licenses.mjs → apps/web/src/features/legal/licenses.json)

[F. 보안·품질]
F1. pnpm audit --prod (심각 이상만 고치고, 새 메이저 버전은 먼저 물어봐 줘)
    - pnpm outdated: 마이너·패치 업데이트 목록만 보고 (올리기는 내가 정할게)
F2. pnpm check, pnpm e2e 통과
F3. 문구 규칙(한 줄 = 한 문장, 짧게) — copy.test.ts

[G. 문서 현행화 — 다음 작업이 헤매지 않게]
G1. PROGRESS.md "현재"·"다음에 할 일"이 지난 달 커밋과 맞는지 (끝난 일은 기록으로, 결정 대기는 docs/08로)
G2. docs/code-map.md·docs/03-architecture.md가 실제 폴더·라우트·서버 서비스와 맞는지 (새 파일·지운 파일)
G3. docs/README.md 문서 목록의 상태(현행·기록·보류)가 맞는지

[H. 사람이 직접 볼 것 — 결과 보고 끝에 체크리스트로 남겨 줘]
- 서버 PC 백업이 매일 생기는지(E:\\TripPocketBackup), 디스크·문서 용량 (pnpm admin:data list)
- 분기마다(1·4·7·10월) 백업 복구 리허설 (ops/README.md §3)
- Windows 업데이트 뒤 서버가 자동으로 켜졌는지 (안 켜졌으면 "TripPocket 서버 재시작.bat")
- 로그인 앱(Google·카카오)·지도 키의 허용 도메인이 trippocket.day로 제한돼 있는지
- Google Cloud 콘솔: 지도·장소·Routes·Vision 하루 할당량(quota) 상한이 그대로인지 — 앱을 거치지 않는 키 사용까지 막는 마지막 안전장치 (서버가 꺼지면 앱은 유료 지도를 막는다)
- 도메인 trippocket.day 갱신일 (자동 갱신·결제 수단)
- 관리자 → API 사용량에서 남은 무료량 20% 아래(주황·빨강)였던 API
- 공공데이터포털 마이페이지 → 개발계정: 활용기간 끝나는 날 (한 달 전이면 [연장신청])
- Google 결제 카드 만료일, Cloudflare API 토큰 만료일
- 반년 안에 Google 계정으로 로그인한 적이 있는지 (안 쓰면 Google 로그인 설정이 자동 삭제)
- 숨긴 후기, 개선 제안 답장
- 실험실 기능 중 정식으로 넣거나 뺄 것 (켜 두고 써 본 느낌)

끝나면 바뀐 것·출처 링크·확인 못 한 것을 표로 보고해 줘. 커밋·푸시는 보고를 보고 내가 말할게.`;
}
