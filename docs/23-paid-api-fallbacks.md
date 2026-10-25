# 23. 유료 API — 무료 사용량이 끝나면 (대체 API·대체 방법 설계)

> 2026-10-26 사용자 요청: "모든 과금이 되는 api에 대해 무료 사용량이 끝나면 대체 가능한 다른 api가 있는지 봐주고 없으면 대체 방법도 정리. 바로 적용하지 말고 설계문서 먼저".
> **이 문서는 설계만** — 아직 아무것도 바꾸지 않았다. 구현은 사용자가 고른 항목만, 나중에.
> 가격·무료량은 2026-10-26에 공식 문서로 다시 확인 (출처 맨 아래). 구현 직전에 한 번 더 확인한다 (CLAUDE.md "과금 기준은 항상 최신").

## 0. 지금 상태 한눈에

지금은 모든 유료 API가 **무료량의 90%에서 자동 중지**(`services/apiUsage.ts`)된다 → 과금은 생기지 않지만, 멈춘 뒤에는 그 기능이 빈다.
아래 표의 "멈추면 지금"이 그 빈 자리, "대체"가 이 문서의 제안.

| API (`APIS` id) | 쓰는 곳 | 무료량 (공식) | 넘으면 단가 | 멈추면 지금 | 대체 (추천 순) |
|---|---|---|---|---|---|
| Google Text Search Pro (`google_places_search`) | 해외 장소 검색 | 월 5,000 | 1,000건당 $32 | 503 안내 + 지도 앱 검색 링크 | ① Google 자동완성+상세 Essentials로 바꾸기 ② Geoapify ③ Photon·Nominatim(OSM) ④ 링크·직접 입력 |
| Google Place Details Enterprise (`google_places_details`) | 평점·영업시간 | 월 1,000 | 1,000건당 $20 | 평점·영업시간 안 보임 | ① 트립포켓 리뷰 ② OSM 영업시간(Overpass) ③ "Google 지도에서 보기" 링크 |
| Google Place Details Pro (`google_places_local`) | 택시 카드 현지어 이름 | 월 5,000 | 1,000건당 $17 | 한국어 이름·주소만 | ① Nominatim 역지오코딩(현지어 `name`) ② Geoapify ③ 주소 복사 |
| Google Maps JS Dynamic Maps (`google_maps_js`) | 해외 일정 지도 | 월 10,000 | 1,000건당 $7 | 다른 지도(네이버)로, 둘 다 없으면 지도 없음 | ① 네이버 지도(이미 자동 전환) ② MapLibre + OpenFreeMap (새 의존성) ③ 목록 + 지도 앱 링크 |
| 네이버 Web Dynamic Map (`naver_maps_js`) | 국내 일정 지도 | 대표 계정 월 600만 | 구간 요금 | Google 지도로 | ① 카카오맵 SDK ② Google 지도 |
| 카카오 키워드·카테고리 검색 (`kakao_keyword`·`kakao_category`) | 국내 장소 검색·AI 추천·가까운 역 | 하루 10만 (월 전체 300만) | 2원/건 | 네이버 검색만으로 | ① 네이버 검색(이미 같이 씀) ② Overpass(역) |
| NAVER API HUB 검색 (`naver_search`) | 국내 장소 검색·블로그 근거 | 월 77.5만 (한시 무료) | 유료 전환 미정 | 카카오만으로 | ① 카카오(이미 같이 씀) |

**급한 순서**: 실제로 무료량이 작은 것은 **Google 3종(장소 검색·상세·현지어)**. 지도·국내 검색은 무료량이 이 앱 규모에 비해 수백 배 커서, 대체는 "있으면 좋음" 수준이다.

## 1. 해외 장소 검색 — Google Text Search Pro (월 5,000)

이미 한 일 (2026-10-26): 해외는 [검색]을 눌렀을 때만 부른다 → 글자마다 부르던 낭비가 없어졌다.

### ① Google 안에서 더 싼 SKU로 바꾸기 (추천 · 새 의존성 없음 · 무료)
- **Autocomplete (New) Essentials**: 월 10,000 요청 무료, 넘으면 1,000건당 $2.83 — 결과 목록에 이름 + 보조 문구(도시·주소)가 와서 지금 드롭다운에 그대로 쓸 수 있다
- 고르면 **Place Details Essentials**(월 10,000 무료, $5): 주소·좌표만 받는다 (이름은 자동완성 결과의 것을 씀)
- 세션 토큰을 쓰면 "자동완성 → 상세"를 한 세션으로 묶어 자동완성 요청은 무료로 처리되는 규칙이 있다 (공식 표의 Autocomplete Session Usage = 무료). **구현 전에 세션 과금 규칙을 공식 문서로 다시 확인**
- 효과: 검색 1번에 Pro(무료 5,000) 대신 Essentials(무료 10,000 + 10,000) → **같은 무료로 약 2배 이상**, 넘어도 단가가 $32 → $2.83+$5
- 약관은 같다: 결과는 Google 지도와 함께 표시, `place_id` 말고는 저장하지 않음 (docs/10 §2.1 그대로)
- 할 일: `services/places.ts`에 `autocompleteGoogle()`·`detailsEssentials()` 추가, `APIS`에 `google_autocomplete`(10,000)·`google_details_basic`(10,000) 등록, 기존 Text Search는 그 둘이 멈췄을 때만

### ② Geoapify Places / Autocomplete (무료 · 키 필요 · 새 의존성 없음)
- 무료 플랜 **하루 3,000 크레딧**(보통 요청 1건 = 1크레딧), 초당 5건, **상업 이용 가능**
- 조건: 결과 근처에 "Powered by Geoapify" 링크 표시 (OSM 데이터라 "© OpenStreetMap" 도)
- 약점: OpenStreetMap 기반이라 일본·대만 **식당·가게는 Google보다 빠진 곳이 많다**. 관광지·역·호텔은 쓸 만함
- 할 일: 서버 키 1개(`GEOAPIFY_KEY`, 계정 만들기 = 사용자), `APIS`에 `geoapify`(freeDaily 3000, group free), 결과 출처 배지 "O"(OSM)

### ③ Photon (komoot 공개 서버) · Nominatim (OSM 공개 서버) — 키 없음
- Nominatim 공개 서버 정책: **초당 1건, 자동완성 용도 금지**, 결과 캐시 권장 → "[검색]을 눌렀을 때만" 방식이라 정책에 맞는다
- Photon 공개 서버: 공정 사용(정해진 숫자 없음), 무거운 사용은 자체 설치 권장
- 둘 다 무료·키 없음, 대신 서버가 바쁘면 느리거나 거절 → 마지막 자동 대체로만
- 할 일: `APIS`에 `nominatim`(freeDaily 보수적으로 500), 요청에 앱 이름 User-Agent 필수

### ④ 그래도 없으면 (지금 있음)
- 지도 앱 검색 링크(`placeSearchLinks`) + 이름 직접 입력. 이건 그대로 둔다

### 쓰는 순서 (제안)
`Google 자동완성(Essentials)` → 멈추면 `Geoapify` → 멈추면 `Nominatim` → 다 막히면 링크.
결과마다 출처 배지(G·O)를 붙여, 사용자가 어디 결과인지 안다.

## 2. 평점·영업시간 — Google Place Details Enterprise (월 1,000)

평점·리뷰·영업시간은 Enterprise SKU에만 있다 → Google 안에서 더 싼 대체가 없다. 대체 **API**도 같은 데이터(평점)는 없다. 그래서 대체 **방법**:

1. **트립포켓 리뷰** (이미 있음, docs/17): 멈췄을 때 그 장소의 우리 리뷰 별점·글을 먼저 보여 준다
2. **영업시간 = OpenStreetMap `opening_hours`** (Overpass, 이미 `APIS`에 있음): 일본·대만 주요 관광지는 꽤 들어 있음, 식당은 드묾. "OSM 기준 · 다를 수 있어요"로 표시
3. **"Google 지도에서 평점 보기"** 링크 (무료, 지금도 있음)
- 넘어도 쓰고 싶으면: 1,000건당 $20 → 월 2,000번이면 약 $20 (1달러 1,400원 어림 약 2.8만 원). 결정은 사용자

## 3. 택시 카드 현지어 이름 — Google Place Details Pro (월 5,000)

- **Nominatim 역지오코딩**(좌표 → 장소, 키 없음): OSM의 `name`은 **현지어**(일본어·중국어)라 택시 카드에 바로 맞다. 공개 서버 정책상 초당 1건 — 택시 카드는 누를 때 한 번이라 충분
- 그다음 Geoapify Reverse Geocoding (같은 무료 3,000/일)
- 그래도 없으면: 한국어 이름 + 주소 복사 버튼 + 지도 앱 열기 (지금 동작)
- 좌표는 서버에 남기지 않는다 (CLAUDE.md) — 요청만 중계하고 로그에 좌표를 쓰지 않음

## 4. 해외 일정 지도 — Google Maps JS (월 10,000)

1. **네이버 지도**로 자동 전환 (이미 `tripMap` 키 선택에 있음). 해외 지도도 그려지지만 상세도는 낮다
2. **MapLibre GL + OpenFreeMap**: 키·가입·요청 한도 없음(기부로 운영), 벡터 지도
   - **새 의존성**(`maplibre-gl`, 지도 화면에서만 지연 로딩) → 사용자 승인 필요 (CLAUDE.md). 첫 화면 크기에는 영향 없음
   - 공용 서비스라 장애 가능 → 마지막 대체로만, 표시: "© OpenMapTiles © OpenStreetMap"
3. 지도 없이 목록 + [지도 앱에서 보기] (지금 동작)

## 5. 국내 지도 · 국내 검색 (무료량이 매우 큼)

- 네이버 지도(월 600만) → 카카오맵 SDK(하루 30만 무료, 넘으면 0.1원/건) → Google 지도. 카카오맵 SDK는 웹 키 등록만 하면 됨(새 npm 의존성 없음, 스크립트 로드)
- 카카오 검색(하루 10만) ↔ 네이버 검색(월 77.5만): 이미 둘을 같이 부르고 한쪽이 멈추면 다른 쪽만 쓴다 → 추가 작업 없음
- **NAVER API HUB 유료 전환이 공지되면**: 단가를 보고 사용자에게 묻는다. 기본안은 "네이버 검색 끄고 카카오만" (월간 갱신 루틴 docs/22에서 공지 확인)

## 6. 공통 구조 (구현할 때)

- 서버에 기능별 **제공자 순서** 한 곳: `capabilities.ts` 예) `overseasSearch: ['google_autocomplete', 'geoapify', 'nominatim']`
  - 각 단계는 `apiAllowed(id)`로 고르고 `guardApi`·`trackApi`를 그대로 거친다 (CLAUDE.md)
  - 관리자 API 사용량 화면에 "지금 쓰는 제공자" 표시
- 결과에 `source` 그대로 (`google`·`naver`·`kakao` + 새 `osm`) → 배지, 출처 표기
- **저장 규칙은 출처마다 다르다**: Google은 `place_id`만, OSM(Geoapify·Nominatim) 결과는 ODbL이라 출처 표기하면 캐시·저장 가능 → 서버 검색 캐시를 OSM 결과에만 길게(예: 7일)
- 사용자에게 보이는 문구: "무료 검색 한도라 다른 지도 정보로 찾았어요" 한 줄 (copy 규칙)

## 7. 무료 등급 API (참고 — 이미 대체 순서가 있음)

| 기능 | 순서 (지금) |
|---|---|
| AI 추천·분석 | Gemini 무료 → Workers AI → Groq → AI 없이 목록만 |
| 환율 | 수출입은행 → jsDelivr 보조 |
| 항공편 불러오기 | AviationStack(월 100) → 직접 입력 |
| 날씨·공휴일 | Open-Meteo · Nager.Date (한도 넉넉) |

## 8. 사용자 결정이 필요한 것

| # | 질문 | 기본안 |
|---|---|---|
| F1 | 해외 검색을 Google 자동완성+상세 Essentials로 바꿀까 | 바꾼다 (무료, 2배 이상) |
| F2 | Geoapify 계정을 만들어 2단계 대체로 쓸까 (가입은 사용자) | 쓴다 |
| F3 | Nominatim·Photon 공개 서버를 마지막 대체로 쓸까 | 쓴다 (택시 카드 현지어 이름 포함) |
| F4 | 해외 지도 마지막 대체로 MapLibre(새 의존성) 넣을까 | 보류 — 네이버 지도로 충분한지 먼저 보기 |
| F5 | 평점·영업시간이 멈추면 돈을 내고 계속할까 | 안 낸다 — 우리 리뷰 + OSM 영업시간 + 링크 |

## 출처 (2026-10-26 확인)

- Google Maps Platform 가격표 (페이지 표기 "Last updated 2026-10-23"): https://developers.google.com/maps/billing-and-pricing/pricing
- 카카오 쿼터 (월 전체 300만, 지도 REST 하루 10만, 장소 검색 초과 2원/건, SDK 0.1원/건, 무료 쿼터는 첫 활성화 앱만 — 2026-07-21 이용 방식 변경 공지): https://developers.kakao.com/docs/latest/ko/getting-started/quota · https://developers.kakao.com/docs/latest/ko/kakaomap/common
- 네이버 Maps 무료 이용량 (대표 계정 월 600만, 콘솔 확인 2026-10-24): https://guide.ncloud-docs.com/docs/maps-app
- NAVER API HUB (한시적 무료, 유료 전환은 사전 공지): https://guide.ncloud-docs.com/docs/apihub-overview
- Geoapify 요금 (무료 하루 3,000 크레딧, 상업 이용 가능, 출처 표기 필수): https://www.geoapify.com/pricing/
- Nominatim 이용 정책 (초당 1건, 자동완성 금지): https://operations.osmfoundation.org/policies/nominatim/
- OpenFreeMap (키·한도 없음, 기부 운영): https://openfreemap.org/
- 확인 못 함 → 추천에서 뺌: Foursquare Places 무료량 (2차 자료끼리 다름)
