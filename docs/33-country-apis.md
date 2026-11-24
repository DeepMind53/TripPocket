# 33. 무료 API 2차 — 키 받을 API 개선 + 나라별 새 API (설계)

- 상태: **설계** (2026-11-25) — 구현은 키·활용신청을 받은 뒤 사용자 요청 때 §6 순서로
- 요청 (2026-11-25): "무료 API 키 기능은 추가 개선이나 신규 기능 포함 가능한 부분이 있을지, 일본·대만·미국 등 주요 국가별 사용 가능한 API가 더 있을지 찾아봐 줘. 설계 문서로 상세 구현 방안 남겨 두고 다음에 구현"
- 바탕: [26 무료 API 더 쓰기](26-free-apis.md) §1 B3·B4·B6·C2·C3 (2026-11-25 적용 결정). 이미 쓰는 API는 [code-map](code-map.md) §3 표
- 조사: 2026-11-25 웹 검색. **표의 한도·주소 중 "확인 필요"는 키를 받은 날 실제로 불러 확인하고 이 문서를 고친다** (docs/30 §9처럼 확인 기록)

## 0. 지키는 원칙 (CLAUDE.md·기존 ADR 그대로)

1. **무료만**. 무료량을 넘으면 과금되는 것은 쓰지 않거나, `APIS`에 등록해 95%에서 자동 중지
2. 모든 외부 호출은 서버 `services/*` → `guardApi`·`trackApi`. 브라우저에서 바로 부르는 것은 키가 없고 출처가 허락할 때만(Open-Meteo처럼)
3. **사용자 위치는 보내지 않는 쪽을 먼저** — 근처 정류장·공원 찾기는 **일정 장소 좌표**(이미 저장된 값)로. 지금 위치가 꼭 필요하면 기존 길 시간 조회(ADR-0004)처럼 서버를 거치되 저장·기록 안 함
4. 새 기능은 **실험실 + [샘플]** (CLAUDE.md, 메모리 "실험실엔 샘플 필수")
5. 출처 표기·라이선스(공공누리·CC BY-SA·ODbL 등)는 화면 아래 한 줄 + 개인정보 처리방침·출처 화면에 추가
6. "혼잡·여유" 같은 **우리 판단 문구는 붙이지 않는다** — 받은 값과 출처만 (B3 사용자 결정, 다른 나라도 같게)

## 1. 한눈에

| # | 나라 | API | 무료 조건 (확인 필요 표시) | 키 | 붙일 기능 | 우선 |
|---|---|---|---|---|---|---|
| K1 | 한국 | 인천공항 **승객예고**(15095066) + **출국장 혼잡도 T2 실시간**(15161098, 1분) | 개발 하루 1,000 | 공공데이터 키 (활용신청) | 출국 날 공항 카드: 시간대별 예상 승객 수 · T2 지금 대기 인원 | ★★★ |
| K2 | 한국 | TAGO **버스정류소정보**(좌표 근접 정류소)·**버스도착정보**(15098530)·도시코드 | 개발 하루 10,000 (확인 필요) | 같은 키 (활용신청 2개) | 국내 여행: 다음 일정 가까운 정류장 버스 도착 | ★★ |
| K3 | 한국 | 기상청 **단기예보**(15084084) — 초단기실황·초단기예보·단기예보 | 개발 하루 10,000, 자동 승인 | 같은 키 | 국내 날씨를 공식 값으로 (시간별·강수 확률) | ★★ |
| C2 | 공통 | ~~REST Countries~~ → **앱에 넣는 나라 표** | — | 없음 | 국가번호·운전 방향·전압 등 | ★ |
| C3 | 해외 | **OpenTripMap** (freemium, 한도 확인 필요) · 대안 **Wikivoyage 목록** | 무료 키 / 없음 | 무료 키 / 없음 | AI 추천 근거·근처 볼거리 보조 | ★ |
| J1 | 일본 | **ODPT** 공공교통 오픈데이터 (`api.odpt.org/api/v4`, `acl:consumerKey`) | 무료, 가입 승인 약 2영업일 | 무료 키 | 도쿄권 **열차 운행 정보(지연·운휴)**, 역 시간표 | ★★★ |
| J2 | 일본 | **기상청 예보 JSON** (`jma.go.jp/bosai/forecast`) — 특보는 이미 씀 | 무료, 키 없음 | 없음 | 일본 날씨를 공식 값으로 보충 | ★ |
| J3 | 일본 | 환경성 **더위 지수(WBGT)·열사병 경계 경보** CSV (841지점, 3시간 간격, 매년 4월 하순~10월 하순) | 무료 | 없음 | 여행지 특보 줄에 "열사병 경계 경보" | ★★ |
| T1 | 대만 | **TDX** 교통 데이터 (버스·MRT·고속철·TRA·YouBike·관광지) | 무료 회원(심사 후), 키 3개까지, 한도는 요금제별 (확인 필요) | 무료 키 | 타이베이 버스 도착·MRT·고속철 시간표, 관광 장소 | ★★★ |
| T2 | 대만 | 환경부 **AQI** (data.gov.tw 40448, 매시) | 무료 (키 필요 여부 확인) | 확인 필요 | 대만 미세먼지 공식 값 | ★ |
| U1 | 미국 | **FAA 공항 상태 (ASWS)** `external-api.faa.gov/asws/api` | 무료, 키 없음, 주요 공항 약 40곳 | 없음 | 미국 공항 지연·지상 정지 | ★★ |
| U2 | 미국 | **NPS 국립공원 API** (`developer.nps.gov/api/v1/alerts`) | 무료 키, 시간당 1,000 | 무료 키 | 국립공원 일정에 폐쇄·주의 알림 | ★★ |
| U3 | 미국 | **NWS 예보** (`api.weather.gov`, 특보는 이미 씀) | 무료, User-Agent | 없음 | 미국·괌·사이판 날씨 공식 값 보충 | ★ |
| U4 | 미국 | **AirNow** (EPA) — 2026-09-30 옛 주소 종료, 새 `/aq/observation/current/ziplatlong/` | 무료 키, 시간당 약 500 (확인 필요) | 무료 키 | 미국 미세먼지 공식 값 | ☆ |
| H1 | 홍콩 | **data.gov.hk** KMB·시티버스 도착(ETA), MTR 다음 열차 | 무료, 키 없음 (약관 확인 필요) | 없음 | 홍콩 버스·지하철 도착 | ★★ |
| S1 | 싱가포르 | **LTA DataMall** 버스 도착 (`AccountKey`, 정류장 5자리) | 무료 계정, 승인 1~2영업일 | 무료 키 | 싱가포르 버스 도착 | ★ |
| G1 | 세계 | **Transitous** (MOTIS 2, `api.transitous.org/api/`) | 무료 — **상업적 사용 불가·사용 정책 확인 필요** | 없음 | 해외 대중교통 경로 (Google Routes 무료량 아끼기) | ☆ (정책 확인 뒤) |
| — | 태국 | TAT(관광청) 공개 API | **확인 안 됨** — 데이터 카탈로그만 | — | 보류 | — |

★ = 효과 대비 작업이 적은 순. ☆ = 조건 확인이 더 필요

## 2. 키 받을 API 개선 (B3·B4·B6·C2·C3)

### 2.1 K1 인천공항 출국장 (B3 개선)
- **찾은 것**: 26에서 정한 15095066(승객예고 — 조회일·다음 날 시간대별 예상 승객 수, T1 출국장 1~6·T2 출국장 1~2)에 더해 **15161098 출국장 혼잡도(T2) — 대기 인원 1분 주기**가 따로 있다
- **화면**: 예약 → 항공(ICN 출발) → 공항 정보 카드(`features/bookings/FlightAirportInfo.tsx`) 아래 한 줄 묶음
  - 출발 전날·당일: "출국장 예상 승객 · 07–08시 T1 3번 1,240명" — 내 출발 시각 앞 3시간을 막대 3개로 (숫자 그대로, 판단 문구 없음)
  - 당일 T2 출발: "지금 T2 출국장 대기 1번 120명 · 2번 80명 (09:41 기준)"
  - 출처 한 줄: "인천국제공항공사 공공데이터"
- **서버**: `services/airportInfo.ts`에 `icnForecast(date)`·`icnT2Queue()` 추가 → `GET /api/flights/icn/crowd?date=` (로그인). 캐시: 예고 30분, T2 1분. `APIS`: `icn_crowd`(하루 1,000)·`icn_t2_queue`(하루 1,000)
- **주의**: 이용 조건 "예상 혼잡도 성격의 대민 서비스는 관리부서와 협의" → 숫자만·출처 표기로 결정(2026-11-25). 협의 요청이 오면 끈다(관리자 API 멈춤으로 바로)
- **실험실**: `icnCrowd` + [샘플](가짜 숫자 막대)

### 2.2 K2 국내 버스 도착 (B4 개선)
- **찾은 것**: 도착정보만으로는 부족 — **정류소정보(좌표 근접 정류소)** + **도시코드 목록** + **도착정보** 3개를 묶어야 한다. 서울은 TAGO가 아닌 서울시 버스 API를 쓰는 경우가 많아 1차는 **서울 밖 국내 도시**(부산·제주·대구 등)만. 창원시 자체 API는 2027-01-01 종료 → TAGO로 일원화됨
- **흐름 (위치 안 보냄)**: 다음 일정 장소 좌표(이미 저장) → 서버가 근접 정류소 3곳(반경 300m) → 사용자가 하나 고르면 그 정류소 도착 목록. 고른 정류소는 그 일정에 기기 저장(`item` 아님 — `data/busStopStore.ts`, 동기화 안 함)
- **화면**: 여행 모드·홈 다음 일정 아래 이동 줄의 [대중교통]을 골랐을 때 "가까운 정류장 · 101번 3분 후 · 5번 12분 후" 한 줄 + [다른 정류장]
- **서버**: `services/tagoBus.ts` — `nearStops(lat,lng)`(도시코드도 같이 돌려줌), `arrivals(cityCode,nodeId)`. 캐시 30초. `APIS`: `tago_stops`·`tago_arrival` 각 하루 10,000(확인 필요). 서버에 좌표를 남기지 않는다(요청 처리 후 버림, 로그 가림)
- **순수 함수**: 정류소 거리 정렬·도착 시간 표시(`domain/busArrival.ts`) + 단위 테스트
- **실험실**: `busArrival` + [샘플]

### 2.3 K3 기상청 단기예보 (B6 개선)
- **찾은 것**: 하루 10,000(개발), 자동 승인. 격자 좌표(nx, ny) 필요 → **위경도 → 격자 변환(람베르트 정각원추) 순수 함수**를 `packages/shared/src/geo/kmaGrid.ts`에 (기상청 공개 공식, 테스트는 서울시청 60·127 등 공식 예시로)
- **쓸 곳**: 국내 여행의 날씨(`useTripWeather`)에서 오늘·내일·모레는 기상청 단기예보(시간별 기온·강수 확률·하늘 상태), 그 뒤는 지금처럼 Open-Meteo. 초단기실황은 여행 모드 "지금 기온" 한 칸
- **서버**: `services/kmaForecast.ts` → `GET /api/weather/kr?lat=&lng=` (좌표는 도시 단위로 반올림해서 받음 — 일정 장소 좌표, 사용자 위치 아님). 캐시: 격자별 1시간(발표 주기 맞춤). `APIS`: `kma_forecast` 하루 10,000
- **표시**: 날씨 칸 출처 "기상청" (해외는 그대로 Open-Meteo). 실패하면 조용히 Open-Meteo
- **실험실**: `kmaWeather` (켜면 국내만 바뀜) + [샘플]

### 2.4 C2 나라 기본정보 — REST Countries 대신 앱에 넣는 표
- **찾은 것**: REST Countries는 **v5로 바뀌며 키·월 한도가 생겼다**(옛 v3.1은 키 없음). 앱 원칙(실행 중 호출 없이 빌드 때 한 번)과 맞지 않고, 운영자가 비상업 무료 데이터셋을 준비 중
- **설계**: 외부 호출 없이 `packages/shared/src/data/countryFacts.ts`에 **우리가 쓰는 20여 개국만** 손으로: 국가번호(+81)·운전 방향(좌/우)·전압·플러그 모양·팁 문화·물 마셔도 되나. 출처는 각 나라 정부·여행 정보, 확인일과 함께 (essentials와 같은 방식, 월간 갱신 G에 넣음)
- **쓸 곳**: 빠른 메뉴 "현지 정보"(지금 교통카드·결제 팁 칸) 아래 한 줄씩. 새 의존성·호출 없음
- 무료 데이터셋이 나오면 그때 바꿀지 다시 묻는다

### 2.5 C3 OpenTripMap — 확인 먼저, 대안 함께
- **찾은 것**: 지금도 freemium으로 보이나 무료 한도가 공식 페이지에서 확인되지 않았다(`dev.opentripmap.org/price`). 키를 받은 날 한도·약관을 확인하고 표를 고친다
- **대안**: **Wikivoyage** 볼거리 목록(See·Do·Eat 틀) — MediaWiki API로 문서 본문을 받아 서버가 목록만 뽑음(키 없음, CC BY-SA, 출처·링크 표기)
- **쓸 곳**: AI 추천의 근거 데이터(docs/14 §5 근거 원칙 그대로 — 원문 id = 위키 문서·목록 이름)와 해외 "근처 찾기" 보조. Google Places 무료량을 아낀다
- **서버**: `services/poiOpen.ts` (`opentripmap` | `wikivoyage` 순서, 하나 실패하면 다음). 캐시 30일(도시 단위). `APIS`: `opentripmap`(확인한 한도)·`wikivoyage`(하루 5,000 자체 제한)

## 3. 나라별 새 기능

### 3.1 J1 일본 열차 운행 정보 (ODPT)
- **무엇**: 도쿄권 노선의 **지연·운휴 정보**(`odpt:TrainInformation`), 역 시간표(`odpt:StationTimetable`). 가입 후 약 2영업일 승인, 키는 `acl:consumerKey` 쿼리
- **화면**: 일본 여행 중 여행 모드 주의 줄(`D2 오늘 주의 한 줄`)에 "JR 야마노테선 지연 (10:20 기준)" — 오늘 일정 장소 근처 역의 노선만 (역 ↔ 노선 표는 ODPT `odpt:Station`에서 한 번 받아 서버 캐시 7일)
- **서버**: `services/odpt.ts` — `lineStatus(operators)` 5분 캐시. `APIS`: `odpt`(무료, 자체 하루 5,000). 약관의 출처 표기 그대로
- **확인 필요**: 도에이·JR 동일본·사철이 같은 키로 되는지, 하네다·나리타 항공편 데이터가 있는지 (있으면 공항 카드에도)
- **실험실**: `jpTrainStatus` + [샘플]

### 3.2 J3 일본 열사병 경계 경보 (환경성 WBGT)
- **무엇**: 841지점 더위 지수 예측(오늘~모레, 3시간 간격)·실황 + 열사병 경계 경보 발표 CSV. **매년 4월 하순~10월 하순만** 제공
- **화면**: 여행지 특보(docs/24) 줄에 "도쿄 열사병 경계 경보 · 더위 지수 31" — 기존 특보와 같은 모양. 날씨 화면 날짜별 칸에 더위 지수 숫자(28 이상만)
- **서버**: `services/jpHeat.ts` — CSV를 하루 몇 번 받아 지점별로 (도시 ↔ 가까운 지점은 좌표로). `APIS`: `jp_wbgt`(무료, 기록만). 기간 밖에는 부르지 않는다
- **확인 필요**: CSV 주소·열 구성(환경성 "전자정보 제공 서비스" 페이지), 2026-02 발표 기준 변경 반영
- 정식 특보 기능 확장이라 실험실 `jpHeat` + [샘플]

### 3.3 T1 대만 TDX
- **무엇**: 버스 도착(ETA)·MRT·고속철(THSR)·대만철도(TRA) 시간표·YouBike 대여소·관광 장소(景點·餐廳·旅館). 회원 가입 → 이메일 확인 → **관리자 심사** → 키 3개까지. 2024-04-29부터 키별 호출 한도가 요금제마다 다름 → **무료 요금제 한도 확인 필요**. 토큰 엔드포인트는 IP당 분당 20회
- **1차 기능 (작게)**: 
  1. 대만 여행 중 다음 일정 가까운 **버스 정류장 도착**(K2와 같은 화면·같은 부품, 서버 어댑터만 다름)
  2. 예약 "기차" 종류에서 **고속철 시간표로 채우기**(출발·도착역 고르면 그날 열차 목록 → 고르면 편명·시각 채움)
- **서버**: `services/tdx.ts` — OAuth 토큰(클라이언트 자격 증명, 만료 전 재사용, 메모리 보관) + `busEta`·`thsrTimetable`. `APIS`: `tdx`(확인한 무료 한도). 키는 `.env` `TDX_CLIENT_ID`·`TDX_CLIENT_SECRET`
- **실험실**: `twTransit` + [샘플]

### 3.4 H1 홍콩·S1 싱가포르 버스·지하철 도착
- **홍콩**: data.gov.hk 시티버스 ETA(1분 갱신, 공식 데이터셋), KMB·LWB ETA(2024-07 추가), MTR 다음 열차(노선+역 코드). 키 없음으로 알려졌으나 **약관·정확한 주소는 data.gov.hk 공식 명세로 확인 필요**
- **싱가포르**: LTA DataMall 버스 도착 — 무료 계정 키(`AccountKey` 헤더), 승인 1~2영업일, 정류장 5자리 코드, Singapore Open Data Licence
- **설계**: K2·T1과 **같은 "가까운 정류장 도착" 부품**에 나라별 어댑터만 추가 → `services/transitLive/{kr,tw,hk,sg}.ts`가 같은 모양 `{ stops(lat,lng), arrivals(stopId) }`를 돌려준다. 화면은 하나(`features/travel/StopArrivals.tsx`)
- **실험실**: `busArrival` 하나로 묶어 나라별로 켜짐 (샘플은 나라를 바꿔 보여 줌)

### 3.5 U1 미국 공항 지연 (FAA ASWS)
- **무엇**: 주요 공항 약 40곳의 지상 지연·지상 정지·도착/출발 지연·폐쇄. 키 없음, `application/json` 요청, 주소 `https://external-api.faa.gov/asws/api` (명세의 경로가 빠져 있다는 보고 — 확인 필요). 목록에 없는 공항은 404
- **화면**: 미국 공항(IATA) 항공 예약의 공항 카드에 "JFK 출발 지연 평균 45분 (FAA, 10:20 기준)". 지연 없으면 안 보임
- **서버**: `services/faaStatus.ts` 5분 캐시, `APIS`: `faa_asws`(무료, 기록만)
- 기존 항공편 지연(B2 AirLabs)과 겹치지 않게: 편명 지연이 있으면 그걸, 공항 전체 상황은 이 줄로

### 3.6 U2 미국 국립공원 알림 (NPS)
- **무엇**: 공원별 현재 알림(폐쇄·주의·정보) `/api/v1/alerts?parkCode=`. 무료 키(`data.gov` 키), 시간당 1,000
- **흐름**: 일정 장소 이름·좌표가 국립공원과 맞으면(공원 목록 `/parks` 한 번 받아 서버 30일 캐시, 좌표 거리 + 이름) 그 일정 상세와 여행지 특보 줄에 "요세미티 · 타이오가 도로 폐쇄"
- **서버**: `services/npsAlerts.ts` 1시간 캐시, `APIS`: `nps`(시간당 1,000 → 자체 하루 5,000)
- **실험실**: `usParks` + [샘플]

### 3.7 공식 날씨·대기질 보충 (J2·U3·T2·U4) — 낮은 우선
- 지금 Open-Meteo(예보)·CAMS(대기질)로 전 세계가 된다. 나라 공식 값은 "더 정확할 수 있음" 정도라 **K3(한국)만 먼저**, 나머지는 사용자 불편이 보이면
- 넣게 되면 같은 구조: `services/officialWeather/{kr,jp,us}.ts` → 같은 모양 → 화면 출처만 바뀜

### 3.8 G1 Transitous (해외 대중교통 경로) — 정책 확인 뒤
- 무료·국경 없는 경로 API(MOTIS 2). **사용 정책에 상업적 사용 불가·앱 소개 조건**이 있다는 보고 — 트립포켓은 개인 무료 앱이지만 공식 정책 원문을 확인하고 사용자 결정을 받는다
- 쓰면: Google Routes 대중교통 무료량이 끝났을 때의 대체(docs/23 순서에 한 단계)

## 4. 공통 구조

```
apps/server/src/services/
  transitLive/{kr,tw,hk,sg}.ts   # 같은 모양: stops(lat,lng) · arrivals(stopId)
  officialWeather/kr.ts          # 기상청 (격자 변환은 packages/shared/geo/kmaGrid.ts)
  odpt.ts · jpHeat.ts · faaStatus.ts · npsAlerts.ts · poiOpen.ts
apps/server/src/routes/
  transit.ts  GET /api/transit/stops?lat&lng&country · GET /api/transit/arrivals?country&stop
  info.ts     (기존) + GET /api/info/jp-trains · /api/info/us-airport/:iata · /api/info/us-parks
apps/web/src/
  features/travel/StopArrivals.tsx   # 나라 상관없이 하나
  domain/busArrival.ts               # 정렬·표시 순수 함수
  data/api/transit.ts
```
- 모든 서비스: `guardApi(id)` → 호출 → `trackApi(id)`, 실패·한도면 빈 결과(화면은 조용히 숨김). 관리자 API 사용량 화면에 새 id 자동 표시
- 캐시는 서버 메모리(지금 `airportInfo.ts`와 같게), 사용자 좌표는 캐시 키에 넣지 않는다(정류장 id·격자·공항 코드만)
- 개인정보 처리방침·출처 화면(`features/legal/content.ko.ts`)에 새 출처 추가

## 5. 테스트
- 서비스마다 가짜 응답으로 단위 시험(`apps/server/test/*.test.ts`) — 한도(`ApiPaused`)·빈 응답·형식 오류
- 순수 함수: `kmaGrid`(기상청 공식 예시 좌표), `busArrival`(정렬·"곧 도착")
- 화면: 실험실 [샘플]·켜고 끄기(`labs.test.tsx`), 여행 모드 이동 줄에 도착 한 줄
- 좌표가 서버 기록·캐시 키에 남지 않는지 시험 (기존 routes 시험과 같은 방식)
- 실제 호출 확인은 임시 `apps/server/test/zz-live.test.ts`에서만, 끝나면 지운다 (docs/28과 같게)

## 6. 구현 순서 (한 묶음 = 한 커밋, 각 묶음 끝에 사용자 확인)
1. **K1 인천공항 출국장** — 키만 있으면 바로, 화면 작음
2. **K3 기상청 단기예보** + 격자 변환
3. **J1 일본 열차 운행 정보** (ODPT 승인 뒤)
4. **정류장 도착 공통 부품** + K2(국내) → T1(대만 TDX) → H1(홍콩) → S1(싱가포르)
5. **J3 열사병 경보** (4~10월 기간에 맞춰)
6. **U1 FAA 공항 지연** · **U2 국립공원**
7. **C2 나라 표**(호출 없음) · **C3 볼거리 보조**(OpenTripMap 한도 확인 뒤, 아니면 Wikivoyage)
8. 보류: 공식 날씨·대기질(J2·U3·T2·U4), Transitous, 태국

## 7. 사용자 할 일 (키·신청)

| API | 어디서 | 받을 것 | 걸리는 시간 |
|---|---|---|---|
| 인천공항 승객예고(15095066)·출국장 혼잡도 T2(15161098) | data.go.kr 해당 페이지 → 활용신청 | 지금 공공데이터 키 그대로 | 보통 바로~1일 |
| TAGO 버스정류소정보·버스도착정보(15098530) | data.go.kr → 활용신청 2개 | 같은 키 | 보통 바로 |
| 기상청 단기예보(15084084) | data.go.kr → 활용신청 | 같은 키 | 자동 승인 |
| ODPT | developer.odpt.org 가입 → 이용 신청 | consumerKey → `.env` `ODPT_KEY` | 약 2영업일 |
| TDX | tdx.transportdata.tw 회원 가입 → 이메일 확인 → 심사 | Client Id·Secret → `.env` `TDX_CLIENT_ID`·`TDX_CLIENT_SECRET` | 심사 며칠 |
| NPS | nps.gov/subjects/developer → Get API Key | 키 → `.env` `NPS_API_KEY` | 바로 |
| LTA DataMall | datamall.lta.gov.sg → Request for API Access | AccountKey → `.env` `LTA_ACCOUNT_KEY` | 1~2영업일 |
| OpenTripMap | dev.opentripmap.org 가입 | 키 → `.env` `OPENTRIPMAP_KEY` (한도 확인) | 바로 |
| (선택) AirNow | docs.airnowapi.org 가입 | 키 | 바로 |

- 키가 없으면 그 기능은 비어 있고(조용히 숨김), 관리자 API 사용량에 "키 없음"으로 보인다 (지금 AirLabs와 같게)

## 8. 결정이 필요한 것 (구현 때 하나씩 묻기)
| Q | 질문 | 추천 |
|---|---|---|
| Q1 | 정류장 도착: 일정 장소 좌표로만 찾을까, [지금 위치에서] 버튼도 둘까 (위치는 저장·기록 안 함) | 일정 장소만 먼저 |
| Q2 | C2 나라 표: 어떤 칸을 넣을까 (국가번호·운전 방향·전압·플러그·팁·수돗물) | 6개 모두, 빠른 메뉴 현지 정보 아래 |
| Q3 | Transitous: 사용 정책 원문 확인 뒤 쓸지 | 정책 확인 뒤 결정 |
| Q4 | 공식 날씨(일본·미국): 지금 넣을지 | 한국만 먼저 |
| Q5 | 인천공항 숫자: 막대 그림을 넣을지 숫자만 | 숫자 + 작은 막대 (판단 문구 없음) |

## 출처 (2026-11-25 검색)
- TDX: [TDX 가이드](https://bookdown.org/chiajungyeh/TDX_Guide/), [SampleCode](https://github.com/tdxmotc/SampleCode), [data.gov.tw 85853](https://data.gov.tw/dataset/85853)
- ODPT: [Zenn 사용기](https://zenn.dev/greenteabiscuit/articles/5613babc3e6648), [gist](https://gist.github.com/haraki/8256f6edbe73ccaae98e)
- 환경성 WBGT: [2025-04-01 공지](https://www.wbgt.env.go.jp/pdf/notice/20250401_notice.pdf), [2026-02-02 공지](https://www.wbgt.env.go.jp/pdf/notice/20260202_notice2.pdf), [CSV 안내](https://www.wbgt.env.go.jp/data_service_sample/csv_download_sample1_20200813.pdf)
- 인천공항: [15095066](https://www.data.go.kr/data/15095066/openapi.do), [15161098 메타](https://www.data.go.kr/catalog/15161098/openapi.json)
- TAGO: [15098530 안내 모음](https://wikidocs.net/475134), [15098533](https://www.data.go.kr/data/15098533/openapi.do)
- 기상청: [15084084](https://www.data.go.kr/data/15084084/openapi.do), [API허브 연계 15139470](https://www.data.go.kr/data/15139470/openapi.do)
- REST Countries: [API versions](https://restcountries.com/docs/countries/api-versions), [roadmap](https://restcountries.com/roadmap)
- OpenTripMap: [apis.io](https://apis.io/providers/opentripmap/), [Jentic](https://jentic.com/apis/opentripmap.com/opentripmap)
- Wikivoyage: [Wikimedia Enterprise](https://enterprise.wikimedia.com/project-data/wikivoyage-api/), [Wikidata 자료](https://www.wikidata.org/wiki/Wikidata:Wikivoyage/Resources)
- 홍콩: [Citybus ETA](https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta), [교통 카테고리 공지](https://data.gov.hk/en-datasets/category/transport?page=1)
- 싱가포르: [LTA DataMall](https://datamall.lta.gov.sg/content/datamall/en.html), [API 약관](https://datamall.lta.gov.sg/content/datamall/en/api-terms-of-service.html)
- FAA: [ASWS (apis.io)](https://apis.io/apis/faa/faa-airport-status-web-service/), [faadelays](https://pypi.org/project/faadelays/2023.9.1)
- NPS: [API Guides](https://www.nps.gov/subjects/developer/guides.htm), [Get Started](https://www.nps.gov/subjects/developer/get-started.htm)
- AirNow: [FAQ](https://docs.airnowapi.org/faq), [2026-06 변경](https://docs.airnowapi.org/docs/AirNowAPIUpdates2026June.pdf)
- 대만 AQI: [data.gov.tw 40448](https://data.gov.tw/dataset/40448)
- Transitous: [API](https://transitous.org/api/), [README](https://github.com/public-transport/transitous/blob/main/README.md)
- 태국: [TTD open API](https://admin.thailandtourismdirectory.go.th/manual/ttd-open-api.pdf)
