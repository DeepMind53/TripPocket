import { EMERGENCY_CHECKED_AT, ESSENTIALS_CHECKED_AT } from '@trippocket/shared';

/**
 * 관리자 월간 갱신 요청문 (사용자 요청 2026-10-27): 팝업에서 [복사]해 Claude에게 그대로 붙여 넣는 글.
 * 긴 글이라 i18n 키 대신 이 파일에 둔다 (법적 고지와 같은 방식). 목록 근거: docs/22-recurring-tasks.md.
 * 새로 주기적 확인이 필요한 정보를 앱에 넣으면 여기와 docs/22에 함께 더한다
 */
export function monthlyUpdateRequest(month: string): string {
  return `트립포켓 ${month} 월간 정보 갱신을 해 줘. (D:\\Travel_Planner, docs/22-recurring-tasks.md 기준)

모든 항목은 공식 출처(정부·공관·관광청·서비스 공식 문서)로 다시 확인하고, 바뀐 것만 고쳐 줘.
확인한 항목은 확인 날짜(checkedAt 상수)를 오늘로 바꾸고, 확인하지 못한 것은 그대로 두고 보고해 줘.

[A. 앱에 담긴 정보]
1. 나라별 입국 필수 항목 (비자·무비자 기간·입국신고·전자여행허가 요금·여권 기준)
   - packages/shared/src/data/essentials.ts (지난 확인: ${ESSENTIALS_CHECKED_AT})
2. 나라별 이벤트·혜택: 끝난 것은 빼고, 새로 생긴 공식 이벤트는 더해 줘
   - 같은 파일 TRAVEL_EVENTS (각 checkedAt)
3. 긴급 연락처: 나라별 경찰·구급 번호, 외교부 영사안전콜센터 번호
   - packages/shared/src/data/emergency.ts (지난 확인: ${EMERGENCY_CHECKED_AT})
   - 아직 못 넣은 나라(호주·캐나다·말레이시아·마카오·괌)도 공식 출처가 확인되면 추가
4. 공휴일
   - 다음 해 태국·말레이시아 데이터 (scripts/gen-holidays.mjs → apps/web/src/data/holidays)
   - 대만: TaiwanCalendar에 다음 해 파일이 올라왔는지 (apps/web/src/data/services/travelInfo.ts)
   - 한국 임시공휴일·대체공휴일이 새로 정해졌는지 (Nager.Date 반영 여부)
5. 공항 목록·터미널: packages/shared/src/data/airports.ts
6. 여행 회화·택시 카드 문구가 어색한 곳이 있는지
7. 환율 보조 출처 동작 (apps/web/src/data/services/fxService.ts)
8. 여행지 특보: 나라별 기상청 특보 링크가 열리는지, 새로 약관이 허락된 나라가 있는지
   - packages/shared/src/alerts/alerts.ts, docs/24 §7
   - 일본 기상청 새 경보 코드표(2026-05 개편)가 공개됐는지 → 공개되면 이름 없는 코드 채우기
     (apps/server/src/services/nationalAlerts.ts JMA_CODE)
9. 도움말·소개 카드 그림이 지금 화면·기능과 맞는지 (features/me/IntroCarousel.tsx, legal/content.ko.ts HELP)

[B. 무료 사용량·요금 — 과금 방지]
1. 외부 API 무료 한도·요금 변경 (Google 지도·장소·Routes, 카카오, 네이버 지도·검색(API HUB 한시적 무료 끝나는지),
   Geoapify, Gemini·Workers AI·Groq, 수출입은행, AviationStack, Open-Meteo, OpenFreeMap, Overpass,
   공공데이터포털(외교부·기상청), GDACS·USGS·일본·미국·대만·캐나다 기상청, 웹 푸시)
   - apps/server/src/services/apiUsage.ts APIS + docs/code-map.md §3 표
   - 무료로 쓰는 기반 서비스: Cloudflare Pages·Functions(하루 10만 요청), Tailscale Funnel, GitHub Actions
2. 한도가 끝났을 때 대체 API·대체 기능이 아직 맞게 동작하는지 (docs/23-paid-api-fallbacks.md)
3. 유료 서비스 가격 참고 문서: docs/21-paid-services.md
4. API 키 유효기간: apps/server/.env 각 키 위 [유효기간] 안내를 다시 확인
   - 값은 출력하지 말고, 유효기간 정책이 바뀐 서비스만 알려 줘
5. API 주소·버전 폐기 공지 (전에 실제로 바뀐 적 있음: 수출입은행 도메인 2026-04, 일본 기상청 경보 데이터 2026-05)
   - 공공데이터포털 TravelAlarmService2·SptravelWarningServiceV2·WthrWrnInfoService, 대만 W-C0033-001,
     네이버 지도 v3, Google Maps JS·Places(New)·Routes, 카카오 로컬, Geoapify, AviationStack
6. AI 모델 이름이 폐기·교체 예정인지 (Gemini·Workers AI·Groq 기본 모델 — apps/server/src/config.ts *_MODEL)

[C. 법적 고지·출처]
1. 개인정보처리방침·이용약관·데이터 출처가 지금 쓰는 서비스와 맞는지 (apps/web/src/features/legal/content.ko.ts)
2. 오픈소스 라이선스 목록 갱신 (apps/web/src/features/legal/licenses.json)

[D. 보안·품질]
1. pnpm audit --prod (심각 이상만 고치고, 새 메이저 버전은 먼저 물어봐 줘)
   - pnpm outdated: 마이너·패치 업데이트 목록만 보고 (올리기는 내가 정할게)
2. pnpm check, pnpm e2e 통과
3. 문구 규칙(한 줄 = 한 문장, 짧게) — copy.test.ts

[E. 사람이 직접 볼 것 — 결과 보고 끝에 체크리스트로 남겨 줘]
- 서버 PC 백업이 매일 생기는지(E:\\TripPocketBackup), 디스크·문서 용량 (pnpm admin:data list)
- 분기마다(1·4·7·10월) 백업 복구 리허설 (ops/README.md §3)
- Windows 업데이트 뒤 서버가 자동으로 켜졌는지 (안 켜졌으면 "TripPocket 서버 재시작.bat")
- 로그인 앱(Google·카카오·네이버)·지도 키의 허용 도메인이 trippocket.day로 제한돼 있는지
- 도메인 trippocket.day 갱신일 (자동 갱신·결제 수단)
- 관리자 → API 사용량에서 한도 20% 아래인 API
- 공공데이터포털 마이페이지 → 개발계정: 활용기간 끝나는 날 (한 달 전이면 [연장신청])
- Google 결제 카드 만료일, Cloudflare API 토큰 만료일
- 반년 안에 Google 계정으로 로그인한 적이 있는지 (안 쓰면 Google 로그인 설정이 자동 삭제)
- 신고된 후기, 개선 제안 답장
- 실험실 기능 중 정식으로 넣거나 뺄 것 (켜 두고 써 본 느낌)

끝나면 바뀐 것·출처 링크·확인 못 한 것을 표로 보고해 줘. 커밋·푸시는 보고를 보고 내가 말할게.`;
}
