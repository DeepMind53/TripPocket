# 34. 무료 API 3차 — 한국인이 많이 가는 20개 나라 + 세계 공통 (설계)

- 상태: **설계** (2026-11-26) — 구현은 사용자 요청 때 한 번에 (§7 순서). 키·활용신청이 필요한 것은 §8 목록
- 요청 (2026-11-26): "여행과 관련되거나 내 앱에 추가했을 때 시너지가 나거나 도움이 될 만한 무료 API를 더 알려 줘. 한국 것뿐 아니라 해외 것도, 한국인이 많이 가는 나라 20개 정도 추려서 상세하게. 찾은 것은 설계 문서에 추가, 나중에 한 번에 구현"
- 바탕: [26 무료 API](26-free-apis.md) · [33 무료 API 2차](33-country-apis.md) (일본 ODPT·WBGT, 대만 TDX, 미국 FAA·NPS, 홍콩 버스·MTR, 싱가포르 LTA, 한국 인천공항 혼잡·TAGO·기상청은 **33에 있음 — 여기서는 겹치지 않게 뺐다**)
- 이미 쓰는 API(`apps/server/src/services/apiUsage.ts` `APIS`): Google 장소·경로·정적 지도·Vision, 네이버·카카오, Open-Meteo, Nager.Date, Frankfurter, 수출입은행 환율, 외교부 입국·안전·특보, 기상청 특보, JMA, NWS, 대만 CWA, 캐나다 ECCC, GDACS, USGS, AirLabs, 인천공항·한국공항공사 운항, TourAPI, 에어코리아, Overpass, Wikipedia 등
- 조사: 2026-11-26 웹 검색. **"확인 필요" 표시는 구현하는 날 실제로 불러 보고 이 문서를 고친다** (33과 같은 규칙)

## 0. 지키는 원칙 (33 §0 그대로 + 하나 추가)

1. 무료만. 넘으면 과금되는 것은 `APIS`에 등록하고 95%에서 자동 중지
2. 외부 호출은 서버 `services/*` → `guardApi`·`trackApi`
3. 사용자 위치는 보내지 않는 쪽 먼저 — **일정 장소 좌표·도시 이름·공항 코드**로 찾는다
4. 새 기능은 실험실 + [샘플]
5. 출처·라이선스 표기 (CC BY-SA·ODbL·Open Government Licence 등)
6. 받은 값과 출처만, 우리 판단 문구("위험해요·여유로워요") 없음
7. **(새로) "비상업 용도만" 조건 표시** — 앱스토어 유료화(2026-11 수익모델 분석)를 하면 바꿔야 하는 API에는 표에 **[비상업]** 을 붙인다. 지금 쓰는 **Open-Meteo도 [비상업]**(무료는 하루 10,000·시간 5,000·분 600 호출, 상업은 유료 API) — 유료화 결정 때 함께 검토

## 1. 나라 고르기 (20개)

한국 출국 통계(2025 출국 약 2,958만 명) · 일본 945만 명(JNTO) · 중국(홍콩·마카오 포함) 315만 명 · 아고다 2025 한국인 인기 여행지(도쿄·후쿠오카·오사카·나트랑·발리·다낭·방콕 등)를 바탕으로, 아시아 위주 + 유럽·대양주 장거리 상위를 골랐다.

| 묶음 | 나라 |
|---|---|
| 아시아 근거리 (12) | 일본 · 베트남 · 중국 · 태국 · 필리핀 · 대만 · 홍콩 · 마카오 · 싱가포르 · 말레이시아 · 인도네시아 · 미국령 괌·사이판 |
| 장거리 (8) | 미국 본토·하와이 · 프랑스 · 이탈리아 · 스페인 · 영국 · 독일 · 스위스 · 호주 |
| 참고 (자료가 적음) | 체코(프라하) · 튀르키예 · 몽골 · 라오스 |

## 2. 한눈에 — 새로 찾은 API

★ = 효과 대비 작업이 적은 순. ☆ = 조건 확인이 더 필요

### 2.1 한국 (출국·귀국 날)

| # | API | 무료 조건 | 키 | 붙일 기능 | 우선 |
|---|---|---|---|---|---|
| K4 | 인천국제공항공사 **주차 정보**(구역별 주차 대수·총 면수) · T1 주차면 현황(15107228) · T2(15160956) | 개발 하루 1,000, 운영 신청 시 10,000 | 공공데이터 키 (활용신청) | 출국 날 공항 카드: "장기 주차장 P1 남은 자리 312" (차로 가는 사람만, 설정) | ★★★ |
| K5 | 한국공항공사 **전국 공항 실시간 주차**(15158681) · 김포 발렛 혼잡(15158628) · **공항 혼잡도**(15159598, 2026-05 등록, 구간별) | 공공데이터 기본 (확인 필요) | 같은 키 | 김포·김해·제주·대구 출발 공항 카드 (K4와 같은 칸) | ★★ |
| K6 | 외교부 **국가·지역별 재외공관 정보** | 공공데이터 기본 (명세 확인 필요) | 같은 키 | 여행지 나라의 **대사관·영사관 주소·전화**를 빠른 메뉴 "비상 연락"에 — 오프라인으로도 보이게 기기에 저장 | ★★★ |
| K7 | 질병관리청 **해외감염병 NOW** | **API 확인 안 됨** (누리집만) — 전수신고 감염병 API(국외 감염 구분)는 나라별인지 확인 필요 | — | 출발 전 필수 항목에 "뎅기열 유행 (질병관리청)" — API가 없으면 보류 | ☆ |

### 2.2 아시아

| # | 나라 | API | 무료 조건 | 키 | 붙일 기능 | 우선 |
|---|---|---|---|---|---|---|
| HK2 | 홍콩 | **홍콩 천문대(HKO) Open Data** `data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=` `warnsum`(특보 요약)·`warningInfo`·`rhrread`(지금 날씨)·`fnd`(9일 예보) | 무료, 상업·비상업 모두 허용, 키 없음 | 없음 | **태풍 신호(T8 등)·폭우 경보**를 여행지 특보(docs/24) 줄에 — 홍콩은 태풍 신호에 따라 가게·교통이 멈춰서 효과가 크다 | ★★★ |
| MO1 | 마카오 | 지구물리기상국(SMG) 태풍 신호 | **공개 API 확인 안 됨** (gov.mo 화면만) | — | 보류 — 홍콩 HKO 신호 + GDACS로 대신 | ☆ |
| MY1 | 말레이시아 | **data.gov.my 기상 API** `api.data.gov.my/weather/forecast` · `/weather/warning` · `/weather/warning/earthquake` (MET Malaysia 제공) | 무료, 키 없음 (한도는 개발자 문서 rate-limit 페이지 확인 필요) | 없음 | 코타키나발루·쿠알라룸푸르: 여행지 특보 + 날씨 보충. 필드 설명이 말레이어라 번역표 필요 | ★★ |
| ID1 | 인도네시아 | **BMKG Open Data** `data.bmkg.go.id` — 지진 `autogempa.json`·`gempadirasakan.json`(느낀 지진), 예보 `api.bmkg.go.id/publik/prakiraan-cuaca?adm4=` | 무료, 키 없음 (이용 조건 확인 필요) | 없음 | 발리: "발리 남부 규모 4.8 느낀 지진 (BMKG)" 특보 줄. 예보는 행정 코드(adm4)가 필요해 **발리 주요 지역 코드 표**를 앱에 넣는다 | ★★ |
| SG2 | 싱가포르 | **data.gov.sg NEA** 2시간 예보(30분마다)·24시간·4일·실시간 강수(1분)·자외선 | 무료, 키 없이 되지만 **키가 있으면 한도 높음**, 2025 하반기부터 한도 적용(수치 확인 필요) | 무료 키 (선택) | 싱가포르 "2시간 뒤 소나기" — 동네(구역) 단위라 여행 모드 주의 줄과 잘 맞음 | ★★ |
| TH1 | 태국 | 기상청(TMD) `data.tmd.go.th` (uid·ukey 방식) | 공개 데이터라고 안내, **개인 키 발급 절차 확인 필요** | 확인 필요 | 방콕·푸껫 공식 예보·지진 — 확인 전까지 Open-Meteo로 충분 | ☆ |
| PH1 | 필리핀 | PAGASA 자동기상관측 API | **일반 공개 여부 확인 안 됨** (요청서 방식) | — | 보류 — 태풍은 GDACS·JMA 태풍 정보로 대신 | ☆ |
| VN1 | 베트남 | 공식 공개 API **찾지 못함** | — | — | 날씨·대기질은 Open-Meteo, 대기질 보조는 §2.4 G6 WAQI | — |
| CN1 | 중국 | **고델(Amap) 웹 서비스** — 지오코딩·POI 검색·경로 | 무료 키 (개인 인증 시 한도 상승, **현재 일일 한도 확인 필요**, 무료 정책이 자주 바뀐다는 보고) | 무료 키 (중국 휴대폰 인증 필요할 수 있음) | **중국에서는 Google 지도가 안 됨** → 중국 여행의 장소 검색·주소를 고델로 (docs/23 대체 순서의 중국 칸). 좌표계(GCJ-02) 변환 필요 | ★★ (가입 조건 확인 뒤) |
| CN2 | 중국 | **QWeather(和风天气)** 무료판 | 무료 100 QPM, 공용 서버·보증 없음 (월 한도 확인 필요) | 무료 키 | 중국 도시 예보·특보(중국 기상국 경보) | ☆ |
| JP4 | 일본 | (33 J1~J3 외 추가 없음) | — | — | 일본은 33 ODPT·WBGT·JMA로 충분 | — |
| GU1 | 괌·사이판 | **NWS** (이미 씀 — 괌 예보실 PGUM) | — | — | 33 U3 "미국 공식 예보 보충"에 괌·사이판 포함 확인만 | — |

### 2.3 유럽·대양주·미국

| # | 나라 | API | 무료 조건 | 키 | 붙일 기능 | 우선 |
|---|---|---|---|---|---|---|
| EU1 | 유럽 전체 | **MeteoAlarm** (유럽 기상청 공동) CAP 피드 `feeds.meteoalarm.org` (나라별 Atom) · 새 EDR `api.meteoalarm.org/edr/v1/collections/warnings` | 무료, 키 없음 (이용 조건 원문 확인 필요) | 없음 | 프랑스·이탈리아·스페인·독일·스위스·체코 등 **유럽 기상 특보를 한 번에** — docs/24 여행지 특보의 유럽 칸. 나라별 API를 따로 만들 필요가 줄어든다 | ★★★ |
| UK1 | 영국 | **TfL Unified API** `api.tfl.gov.uk` — 지하철 노선 상태(`/Line/Mode/tube/Status`)·도착 예정 | 무료, 키(`app_key`) 있으면 분당 500 | 무료 키 | 런던 여행 중 주의 줄 "엘리자베스선 일부 운휴 (TfL)" + 33 "가까운 정류장 도착" 부품에 런던 어댑터 | ★★★ |
| CH1 | 스위스 | **transport.opendata.ch** `/connections`·`/stationboard` | 무료, 키 없음으로 알려짐 (timetable.search.ch 한도 따름, 확인 필요) | 없음 | 예약 "기차" 종류에서 **스위스 기차 시간표로 채우기**(출발·도착역 → 그날 열차 → 편명·시각), 역 출발 전광판 | ★★★ |
| DE1 | 독일 | **Bright Sky** `api.brightsky.dev` — DWD 예보 + `/alerts`(공식 특보 CAP) | 무료, 키 없음, 모든 용도 (DWD 이용 조건 따름) | 없음 | 독일 공식 특보 (EU1이 있으면 보충용) | ★ |
| DE2 | 독일 | **DB API Marketplace** Timetables (역 출발·지연) | 무료 등록, `DB-Client-Id`·`DB-Api-Key` (한도 포털 확인 필요) | 무료 키 2개 | 독일 기차 지연 — CH1과 같은 "기차 시간표" 부품에 어댑터 | ★ |
| FR1 | 프랑스 | **SNCF API** (Navitia 기반) — 열차 시간표·운행 장애(`coverage/sncf/disruptions`) | 무료 토큰 (하루 3,000·월 90,000이라는 자료와 하루 1,000이라는 자료가 엇갈림, 확인 필요). 2025 초 키 발급이 잘 안 된다는 보고 | 무료 키 | 프랑스 기차 파업·장애 줄 (프랑스는 파업이 잦아 효과 큼), 기차 시간표 채우기 | ★★ (키 발급 확인 뒤) |
| FR2 | 프랑스 | 메테오프랑스 **Bulletin Vigilance** (portail-api.meteofrance.fr) | 무료 계정·앱별 키 (조건 확인 필요) | 무료 키 | EU1 MeteoAlarm에 이미 들어가므로 **EU1로 대신** | — |
| ES1 | 스페인 | **AEMET OpenData** — 예보·특보(CAP) | 무료 키 (한도 Swagger 문서 확인 필요) | 무료 키 | EU1로 대신, 스페인 날씨 보충만 | — |
| IT1 | 이탈리아 | 공식 열차 API **없음** (ViaggiaTreno는 비공식·불안정) | — | — | 보류 — 기상은 EU1 | — |
| CZ1 | 체코 | **Golemio** (프라하 대중교통 PID 출발·지연) | 무료 등록, 키 (임시 키로 시험 가능, 한도 확인 필요) | 무료 키 | 프라하 트램 도착 — 33 정류장 부품에 어댑터 (낮은 우선) | ☆ |
| AU1 | 호주 | **Transport for NSW Open Data** — 경로·출발·운행 알림(`api.transport.nsw.gov.au/v1/`) | 무료 키, 기본(Bronze) **하루 60,000** | 무료 키 | 시드니 운행 알림·출발 — 정류장 부품에 어댑터 | ★★ |
| AU2 | 호주 | 기상청(BOM) | 공식 JSON API **없음** (XML·CAP 피드, 비공식 JSON은 사용 금지 안내) | — | 특보만 BOM CAP 피드로 (GDACS 보충), 예보는 Open-Meteo | ☆ |
| US5 | 미국 | **국무부 여행 권고** `cadataapi.state.gov/api/TravelAdvisories` (1~4단계) | 무료, 키 없음 | 없음 | 외교부 여행경보 옆에 **"미국 국무부 2단계"** 를 비교로 한 줄 (출처 둘) — 외교부 경보가 없는 지역 보충 | ★★ |

### 2.4 세계 공통 (나라 상관없이 시너지)

| # | API | 무료 조건 | 키 | 붙일 기능 | 우선 |
|---|---|---|---|---|---|
| G2 | **Open-Meteo Marine** `marine-api.open-meteo.com/v1/marine` — 파고·너울·주기 | 지금 Open-Meteo와 같은 무료 조건 **[비상업]** | 없음 | **해변·스노클링·배 일정**(장소 종류가 해변이거나 이름에 비치·섬)에 "파도 1.8m" — 다낭·나트랑·세부·보라카이·발리·괌·하와이 등 **한국인 상위 휴양지 대부분이 바다** → 효과 큼. 내륙 좌표는 값이 없으니 숨김 | ★★★ |
| G3 | **Open-Meteo 대기질 꽃가루**(유럽만)·**자외선** | 같은 조건 [비상업] | 없음 | 이미 받는 Open-Meteo 호출에 변수만 추가 — 동남아 자외선 지수 11+ 날 "자외선 매우 높음 (Open-Meteo)" 숫자 | ★★★ (작업 작음) |
| G4 | **Wikivoyage** (MediaWiki API, CC BY-SA 4.0) — 도시 글의 See·Do·Eat·Sleep 목록 | 무료, 키 없음, 출처·같은 조건 공유 표기 | 없음 | 33 C3 OpenTripMap 대안. **AI 추천 근거(원문 id)** 로 쓰기 좋다 — 목록 한 줄이 근거 하나 (docs/14 §5). 한국어판은 글이 적어 영어판 + 번역 | ★★ |
| G5 | **OpenSky Network** — 항공기 위치 | 익명 하루 400 크레딧·계정 4,000, **연구·비상업만 [비상업]**, 2025-03 이후 새 계정 권한 문제 보고 | 무료 계정 | 마중 나갈 때 "지금 비행기 위치" — 편명 지연(AirLabs)과 겹치고 비상업 조건이라 **낮은 우선** | ☆ |
| G6 | **WAQI (aqicn.org)** — 측정소 실시간 대기질 | 무료 토큰, 데이터는 검증 전 값 | 무료 키 | 베트남·태국·중국처럼 공식 API가 없는 나라의 **측정소 값** 보충 (지금 CAMS는 모델 값) | ★ |

## 3. 앱 기능과 묶어 보기 (시너지)

같은 화면 부품을 나라만 바꿔 쓰는 구조로 묶으면 작업이 줄어든다.

| 부품 (이미 있거나 33에서 설계) | 이번에 붙는 나라 어댑터 |
|---|---|
| **여행지 특보 줄** (docs/24, 정식) | HK2 홍콩 태풍 신호 · MY1 말레이시아 · ID1 인도네시아 지진 · **EU1 유럽 전체** · DE1 · AU2 |
| **가까운 정류장 도착** (33 §3.4 `services/transitLive/*`) | UK1 런던 · AU1 시드니 · CZ1 프라하 |
| **노선 운행 정보 줄** (33 J1 ODPT와 같은 모양) | UK1 TfL 노선 상태 · FR1 SNCF 장애 · DE2 DB |
| **기차 시간표로 예약 채우기** (33 T1 고속철과 같은 모양) | CH1 스위스 · FR1 프랑스 · DE2 독일 |
| **공항 카드** (출국 날, 33 K1) | K4 인천 주차 · K5 김포·김해·제주 주차·혼잡 |
| **날씨 칸** (Open-Meteo) | G2 파고 · G3 자외선·꽃가루 · SG2 싱가포르 2시간 예보 |
| **빠른 메뉴 비상 연락** (지금: 나라별 긴급 번호) | K6 대사관·영사관 주소·전화 |
| **안전 정보** (외교부 여행경보) | US5 미국 국무부 권고 비교 |
| **AI 추천 근거** (docs/14) | G4 Wikivoyage 목록 |
| **장소 검색 대체 순서** (docs/23) | CN1 중국 고델 |

## 4. 상세 설계 (우선 ★★★ 먼저)

### 4.1 HK2 홍콩 태풍 신호·폭우 경보
- **서버** `services/hkoWarnings.ts`: `warnsum`을 10분마다(홍콩 여행이 있을 때만) 받아 `{code, name, issuedAt}`로. 신호 코드(TC1·TC3·TC8NE…·TC10, 황·적·흑 폭우)를 앱 표에 두고 한국어 이름을 붙인다. `APIS`: `hko`(무료, 기록만)
- **화면**: 기존 특보 줄과 같은 모양 — "홍콩 8호 태풍 신호 (홍콩 천문대, 14:20 발표)". 8호 이상이면 푸시(기존 특보 알림 설정을 따름)
- **샘플**: 실험실 `hkWarnings` [샘플]에 8호 신호 예시
- **시험**: 신호 코드 → 이름 변환, 해제(빈 목록) 때 줄이 사라지는지

### 4.2 EU1 MeteoAlarm 유럽 특보
- **서버** `services/meteoalarm.ts`: 여행 목적지 나라 코드 → 나라 Atom 피드(30분 캐시) → CAP의 지역(EMMA_ID·폴리곤)과 **일정 장소 좌표**를 맞춰 그 지역 특보만. 등급 색(노랑·주황·빨강)과 종류(바람·비·폭염·눈·산불…)를 한국어로. `APIS`: `meteoalarm`(무료, 기록만)
- 노랑은 너무 잦아서 **주황·빨강만** 줄에 (노랑은 날씨 화면 안에서만) — 사용자 확인 필요 (§9 Q2)
- docs/24 특보 모듈에 나라 하나 추가하는 방식이라 화면 작업은 거의 없음
- **확인 필요**: 이용 조건 원문, 피드 주소 형식(옛 legacy Atom vs 새 API)

### 4.3 G2 파고 + G3 자외선
- **웹**: 날씨를 받을 때(`useTripWeather`) 해변 일정이 있는 날만 Marine API를 한 번 더 부른다 (키 없음, 브라우저에서 바로 — 지금 Open-Meteo와 같음). 좌표는 장소 좌표를 소수 2자리로 줄여 보낸다(지금 날씨와 같은 규칙)
- **해변 판단**: 장소 종류(Google `beach`·`marina`)·이름(비치·해변·섬·beach·bãi·pantai) → `domain/beachSpot.ts` 순수 함수 + 시험
- **화면**: 그 일정 줄 아래 작은 글씨 "파도 1.8m · 자외선 11 (Open-Meteo)". 판단 문구 없음(§0-6)
- 자외선은 이미 받는 예보 호출에 `uv_index_max` 변수만 추가 → 날짜 칸에 숫자 (8 이상만)

### 4.4 K6 재외공관 연락처
- **서버** `services/mofaMissions.ts`: 나라 코드별 공관 목록을 하루 한 번 받아 캐시. `APIS`: `mofa_missions`(공공데이터, 하루 한도 등록)
- **웹**: 여행을 열 때 목적지 나라의 공관을 받아 **기기에 저장**(설정 캐시 키) → 오프라인에서도 빠른 메뉴 "비상 연락"에 주소·전화. 전화는 `tel:` 링크, 주소 길게 누르면 복사(이미 있는 `useLongPressCopy`)
- 대사관 정보는 사용자 데이터가 아니라 공공 정보라 기기 저장 문제없음
- **확인 필요**: 명세(응답 필드 이름·영사 콜센터 번호 포함 여부)

### 4.5 UK1 TfL · CH1 스위스 기차
- UK1: 33 `transitLive` 어댑터 `uk.ts` — 정류장 찾기 `StopPoint?lat&lon&stopTypes`(일정 장소 좌표), 도착 `StopPoint/{id}/Arrivals`, 노선 상태는 런던 여행 중 15분 캐시. 키는 `.env` `TFL_APP_KEY`
- CH1: `services/railTimetable/ch.ts` — `connections?from&to&date&time` → 33 T1과 같은 모양 `{trainNo, depart, arrive, platform}` 목록. 예약 편집 "기차"에 [시간표에서 고르기] (스위스 역일 때만 보임)

### 4.6 K4·K5 공항 주차
- 출국 날 공항 카드(33 K1)에 한 칸 추가: "단기 P1 남은 자리 312 · 장기 P2 1,204 (인천공항공사, 07:40)". 설정 "공항까지 차로 가요"를 켠 사람만 (기본 끔 — 대부분은 대중교통)
- 인천은 K4, 그 외 공항은 K5 — 공항 코드로 고른다

### 4.7 US5 미국 국무부 여행 권고
- 하루 한 번 전체 목록 받아 서버 캐시 → 나라 코드별 단계. 외교부 경보 화면 아래 "참고: 미국 국무부 2단계 (2026-11-20)". 외교부와 다른 기준임을 밝히는 한 줄(문구는 사용자 확인)

### 4.8 나머지 (★★ 이하)
- MY1·ID1·SG2: 4.1과 같은 특보 모듈에 나라 추가. ID1 발리 adm4 코드 표는 `packages/shared/data/`에 (주요 20곳)
- CN1: 중국 여행일 때만 장소 검색 공급자를 고델로 — 좌표계 GCJ-02 ↔ WGS-84 변환 순수 함수 + 시험. **가입에 중국 휴대폰 인증이 필요하면 보류**
- FR1·DE2: 키 발급이 되면 4.5 부품에 어댑터 추가
- AU1·CZ1: 정류장 부품 어댑터
- G4 Wikivoyage: `services/wikivoyage.ts` — 도시 글 wikitext에서 `{{see|...}}`·`{{eat|...}}` 틀을 읽는 파서(순수 함수 + 시험) → AI 추천 근거 목록. 출처 "Wikivoyage (CC BY-SA 4.0)" 표기
- G6 WAQI: 대기질 공식 API가 없는 나라에서만 측정소 값 보충

## 5. 공통 구조
- 서버 `services/<이름>.ts` + `APIS` 등록(과금 가능 여부·무료량), 모두 `guardApi`·`trackApi`
- 나라 어댑터는 같은 모양을 돌려준다: 특보 `{kind, level, area, issuedAt, source}` · 정류장 `{stops, arrivals}` · 기차 `{trains[]}`
- 캐시는 서버 메모리 + 여행이 있는 나라만 부른다 (아무도 홍콩에 안 가면 HKO도 안 부름)
- 출처 표기: 화면 아래 한 줄 + 출처 화면(설정 → 정보) 목록에 추가

## 6. 테스트
- 각 어댑터: 실제 응답 예시 JSON을 `test/fixtures/`에 두고 변환 시험 (네트워크 없이)
- 특보: 해제·만료·여러 개 겹침
- 해변 판단·좌표계 변환·Wikivoyage 틀 파서: 순수 함수 단위 시험
- 키 없음: 기능이 조용히 숨는지, 관리자 API 사용량에 "키 없음"
- 인가: 새 서버 경로는 로그인 + 여행 멤버 (CLAUDE.md) — 인가 누락 시험 함께

## 7. 구현 순서 (한 묶음 = 한 커밋, 각 묶음 끝에 사용자 확인)
1. **G2·G3** 파고·자외선 (키 없음, 작업 작음, 휴양지 대부분에 효과)
2. **HK2** 홍콩 태풍 신호 + **EU1** 유럽 특보 (키 없음, 특보 모듈 확장)
3. **K6** 재외공관 연락처 (공공데이터 키 그대로)
4. **K4·K5** 공항 주차 (33 K1 공항 카드와 함께)
5. **US5** 미국 국무부 권고 (키 없음)
6. **CH1** 스위스 기차 시간표 + **UK1** TfL (키 받은 뒤)
7. **MY1·ID1·SG2** 동남아 공식 특보·예보
8. 키 발급·조건 확인되는 대로: FR1 · DE2 · AU1 · CN1 · G4 · G6 · CZ1
- 보류: K7 · MO1 · TH1 · PH1 · IT1 · G5 (조건 확인 후 다시)

## 8. 사용자 할 일 (키·신청)

| API | 어디서 | 받을 것 | 걸리는 시간 |
|---|---|---|---|
| K4 인천공항 주차 정보·T1·T2 주차면 | data.go.kr 각 페이지 → 활용신청 | 지금 공공데이터 키 그대로 | 바로~1일 |
| K5 한국공항공사 전국 공항 주차·혼잡도 | data.go.kr 15158681·15159598 → 활용신청 | 같은 키 | 바로~1일 |
| K6 외교부 재외공관 정보 | data.go.kr "재외공관" 검색 → 활용신청 | 같은 키 | 바로~1일 |
| UK1 TfL | api-portal.tfl.gov.uk 가입 → 상품 구독 | `app_key` → `.env` `TFL_APP_KEY` | 바로 |
| FR1 SNCF | digital.sncf.com/startup/api/token-developpeur | 토큰 → `.env` `SNCF_TOKEN` | 바로 (발급 문제 보고 있음) |
| DE2 DB | developers.deutschebahn.com 가입 → Timetables 구독 | `DB_CLIENT_ID`·`DB_API_KEY` | 바로 |
| AU1 NSW | opendata.transport.nsw.gov.au 가입 → 앱 만들기 | `.env` `TFNSW_API_KEY` | 바로 |
| SG2 data.gov.sg (선택) | data.gov.sg 계정 → API 키 | `.env` `DATAGOVSG_KEY` | 바로 |
| CN1 고델 (선택) | lbs.amap.com 개발자 가입 → 웹 서비스 키 | `.env` `AMAP_KEY` (중국 휴대폰 인증 필요 여부 확인) | 확인 필요 |
| G6 WAQI (선택) | aqicn.org/data-platform/token | `.env` `WAQI_TOKEN` | 바로 |
| CZ1 Golemio (선택) | api.golemio.cz/api-keys | `.env` `GOLEMIO_KEY` | 바로 |

키 없이 되는 것: G2·G3·HK2·EU1·US5·CH1·MY1·ID1·DE1·G4

## 9. 결정이 필요한 것 (구현 때 하나씩 묻기)
| Q | 질문 | 추천 |
|---|---|---|
| Q1 | 유료화하면 Open-Meteo(+ Marine)·OpenSky의 [비상업] 조건을 어떻게 할지 | 유료화 결정 때 Open-Meteo 상업 요금제 또는 나라 공식 API로 바꾸기 검토 |
| Q2 | 유럽 특보 노랑 등급도 줄에 보일지 | 주황·빨강만 줄에, 노랑은 날씨 화면 안 |
| Q3 | 공항 주차를 누구에게 보일지 | 설정 "공항까지 차로 가요" 켠 사람만 |
| Q4 | 미국 국무부 권고를 외교부 경보 옆에 둘지 | 외교부 경보 아래 "참고" 한 줄 |
| Q5 | 홍콩 8호 신호 이상 푸시를 보낼지 | 기존 특보 알림 설정을 따라 보냄 |
| Q6 | 파고 숫자를 모든 해변 일정에 보일지, 휴양 여행에서만 | 해변 일정이면 항상 (작은 글씨) |

## 출처 (2026-11-26 검색)
- 출국 통계·인기 여행지: [헤럴드경제 2025 국민 출국](https://www.heraldk.com/article/2026012722573312289), [아고다 2025 한국인 인기 여행지](https://www.agoda.com/press/2025-international-travel-overview-agoda-unveils-the-ranking-of-top-overseas-destinations-among-south-korean-travelers/)
- K4·K5: [인천공항 T1 주차면](https://www.data.go.kr/catalog/15107228/openapi.json), [T2](https://www.data.go.kr/catalog/15160956/openapi.json), [전국 공항 실시간 주차](https://www.data.go.kr/data/15158681/openapi.do), [김포 발렛 혼잡](https://www.data.go.kr/data/15158628/openapi.do), [공항 혼잡도](https://www.data.go.kr/data/15159598/openapi.do)
- K6: [외교부 API 목록](https://wikidocs.net/475811) · K7: [질병관리청 보도](https://www.korea.kr/news/policyNewsView.do?newsId=148966937)
- HK2: [HKO Open Data API 문서](https://www.hko.gov.hk/en/weatherAPI/doc/files/HKO_Open_Data_API_Documentation.pdf), [HKO Open Data 안내](https://www.hko.gov.hk/en/abouthko/opendata_intro.htm)
- MY1: [data.gov.my Weather API](https://developer.data.gov.my/realtime-api/weather) · ID1: [BMKG 데이터 (GitHub infoBMKG)](https://github.com/infoBMKG/data-gempabumi) · SG2: [data.gov.sg 날씨 예보](https://data.gov.sg/collections/weather-forecast/view)
- TH1: [TMD 서비스](https://tmd.go.th/en/service/serviceData) · PH1: [PAGASA FOI](https://foi.gov.ph/agencies/pagasa/) · CN1: [Amap 웹 서비스 문서 (Apifox)](https://apifox.com/apidoc/docs-site/759159) · CN2: [QWeather 구독](https://dev.qweather.com/en/docs/finance/subscription)
- EU1: [MeteoAlarm Python 라이브러리 (피드 형식)](https://meteoalarm.readthedocs.io), [WMO 경보 출처](https://severeweather.wmo.int/sources.html)
- UK1: [TfL Unified API](https://api.tfl.gov.uk/), [TfL 한도 문의](https://techforum.tfl.gov.uk/t/what-is-the-rate-limit-or-quota-for-the-api/22) · CH1: [transport.opendata.ch 문서](https://transport.opendata.ch/docs.html)
- DE1: [Bright Sky](https://brightsky.dev/) · DE2: [DB API Marketplace](https://developers.deutschebahn.com/db-api-marketplace/apis/product/open-station) · FR1: [SNCF API (tech.eu)](https://tech.eu/features/7119/sncf-api-real-time-data) · FR2: [메테오프랑스 Vigilance (data.gouv)](https://www.data.gouv.fr/datasets/api-vigilance-meteorologique-en-temps-reel)
- ES1: [AEMET OpenData](https://www.aemet.es/en/datos_abiertos/AEMET_OpenData) · IT1: [railway-opendata](https://www.github.com/MarcoBuster/railway-opendata) · CZ1: [Golemio 문서](https://operator-ict.gitlab.io/golemio/documentation/en/open-data-api/)
- AU1: [TfNSW API 기본](https://opendata.transport.nsw.gov.au/developers/api-basics) · AU2: [BOM 데이터 피드](https://www.bom.gov.au/catalogue/data-feeds.shtml) · US5: [국무부 API](https://cadataapi.state.gov/)
- G2: [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api), [Open-Meteo 이용 조건](https://open-meteo.com/en/terms) · G4: [Wikimedia APIs](https://www.mediawiki.org/wiki/Wikimedia_APIs) · G5: [OpenSky REST](https://openskynetwork.github.io/opensky-api/rest.html) · G6: [WAQI API](https://aqicn.org/data-platform/api/A363001/)
