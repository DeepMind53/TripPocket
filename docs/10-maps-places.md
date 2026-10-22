# 10. 지도 · 장소(평점/리뷰) · 길찾기

- 문서 상태: 초안 v0.1 (2026-10-22)
- 관련 ADR: [ADR-0004](adr/0004-maps-google-naver.md)
- ⚠️ 요금·약관 수치는 2026-10 조사 기준. **개발 시작 전 공식 페이지에서 재확인**할 것.

## 1. 요구사항
| ID | 기능 | 우선 |
|---|---|---|
| M-1 | 일정 장소를 지도에 표시 (Day별 핀·순서) — 구글 지도 또는 네이버 지도 | P0 |
| M-2 | 장소 검색 → 일정/위시리스트에 추가 | P0 |
| M-3 | 숙소·음식점·볼거리 카테고리 검색 + **평점·리뷰 수·가격대·영업 중·거리 필터** | P0 |
| M-4 | 장소 상세: 평점, 리뷰(최대 5개), 영업시간, 전화, 웹사이트 | P0 |
| M-5 | **현재 위치 → 목적지 길찾기**를 구글/네이버 지도 앱(또는 웹)으로 열기 (대중교통/도보/자동차) | P0 |
| M-6 | 현재 위치 표시, 장소까지 직선거리 | P1 |
| M-7 | 앱 내 경로 미리보기(소요시간) | P2 |

## 2. 제공자별 가능 범위 (핵심 제약)
| 기능 | Google Maps Platform | 네이버 (NAVER Cloud Maps / 검색 API) |
|---|---|---|
| 지도 표시 (웹) | Maps JavaScript API | Maps JavaScript API v3 (Dynamic Map) |
| 장소 검색 | Places API (New) Text/Nearby Search | 검색 API "지역"(결과 최대 5개) |
| **평점 / 리뷰 수** | ✅ `rating`, `userRatingCount` | ❌ 공개 API 없음 |
| **리뷰 본문** | ✅ `reviews` (최대 5개) | ❌ 공개 API 없음 |
| 가격대 / 영업 중 | ✅ `priceLevel`, `currentOpeningHours` | ❌ |
| 길찾기 | URL 딥링크(무료), Routes API(유료) | 앱 URL 스킴(무료), Directions 5/15(자동차만, 유료) |
| 한국 국내 품질 | △ 국내 지도 데이터 반출 제한으로 도보·자동차 길찾기 제한적 (2026-02 고정밀 지도 반출 조건부 승인 보도 — 실제 반영 여부 미확인) | ✅ 국내 최고 수준 |
| 해외 품질 | ✅ | △ 해외는 제한적 |

> **결론**
> - **평점·리뷰 필터링은 Google Places로만 가능**하다. 네이버/카카오는 리뷰·평점 공개 API가 없고, 화면을 긁어오는(스크래핑) 방식은 약관 위반이라 쓰지 않는다.
> - 국내 장소는 네이버 검색 결과를 보여주고 **"네이버 지도에서 리뷰 보기"** 링크로 연결한다.
> - 길찾기는 **지도 앱으로 넘기는 딥링크**가 무료이고 가장 정확하다. 국내=네이버, 해외=구글을 기본값으로 둔다.

### 2.1 Google 약관상 꼭 지킬 것 ⚠️ (재확인 필요)
1. **Google 장소 데이터를 Google 이외의 지도(네이버 지도 등) 위에 표시하면 안 된다.**
   → 네이버 지도 화면에는 Google 검색 결과 핀을 올리지 않는다. Google 결과는 Google 지도나 리스트에만 표시.
2. **캐싱 제한**: `place_id`는 영구 저장 가능. 좌표는 제한된 기간(30일)만 캐시 가능. 평점·리뷰 등 나머지 콘텐츠는 저장하지 말고 조회할 때마다 받아온다.
   → 일정 아이템에는 `googlePlaceId`와 **사용자가 직접 입력·수정한 이름/주소/메모**를 저장. Google에서 받은 좌표는 `fetchedAt`과 함께 저장하고 30일이 지나면 다시 받는다.
3. **출처 표시**: "Google" 로고/표기, 리뷰 작성자 이름·프로필 링크 표시.

## 3. 아키텍처
```
features/places  ──▶ shared/maps/MapProvider (interface)
                        ├─ GoogleMapProvider   (Maps JS, 브라우저 키)
                        └─ NaverMapProvider    (Maps JS v3, 클라이언트 ID)
                 ──▶ data/placesApi  ──HTTPS──▶ 홈 서버 /api/places/*  ──▶ Google Places API (New) (서버 키)
                                                                    └─▶ 네이버 검색 API (시크릿)
                 ──▶ shared/lib/directions.ts  (딥링크 생성, 순수 함수)
```
```ts
interface MapProvider {
  id: "google" | "naver";
  mount(el: HTMLElement, opts: { center: LatLng; zoom: number }): Promise<MapHandle>;
}
interface MapHandle {
  setMarkers(markers: { id: string; position: LatLng; label?: string; color?: string }[]): void;
  drawPath(points: LatLng[]): void;     // Day 순서 선
  fitBounds(points: LatLng[]): void;
  showMyLocation(pos: LatLng | null): void;
  onMarkerClick(cb: (id: string) => void): void;
  destroy(): void;
}
```
- 지도 SDK는 **지도 화면 진입 시에만 지연 로드** (첫 로딩 성능·오프라인 영향 차단).
- 오프라인이면 지도 대신 리스트 + "지도는 온라인에서 표시됩니다" 안내. 길찾기 버튼은 그대로 노출 (지도 앱이 자체 처리).
- 제공자 선택 순서: 사용자 설정 > 여행 국가(KR → 네이버, 그 외 → 구글) > 기본 구글.

### 3.1 서버 프록시를 쓰는 이유
| 이유 | 설명 |
|---|---|
| 키 보호 | Places 서버 키·네이버 시크릿을 브라우저에 노출하지 않음 |
| 비용 통제 | 사용자별 일일 호출 한도, 전체 월 예산 차단 |
| 필드 최소화 | FieldMask를 서버에서 고정 → 비싼 필드를 실수로 요청하지 않음 |
| 일관된 응답 | Google/네이버 응답을 공통 `PlaceSummary` 형식으로 변환 |

→ 장소 검색은 **로그인 사용자만** 사용 가능 (비용·남용 통제). 비로그인 사용자는 수동 입력 + 길찾기 딥링크만.

## 4. 장소 검색 · 필터 설계
### 4.1 카테고리 매핑
| 앱 카테고리 | Google `includedType` | 네이버 검색어 보강 |
|---|---|---|
| 숙소 | `lodging` (hotel, hostel...) | "{지역} 호텔" |
| 음식점 | `restaurant` | "{지역} 맛집" |
| 카페 | `cafe` | "{지역} 카페" |
| 볼거리 | `tourist_attraction`, `museum`, `park` | "{지역} 가볼만한곳" |
| 쇼핑 | `shopping_mall`, `store` | — |

### 4.2 필터 / 정렬
| 필터 | 구현 위치 |
|---|---|
| 최소 평점 (3.5 / 4.0 / 4.5+) | Google Text Search `minRating` (서버) |
| 최소 리뷰 수 (50 / 100 / 500+) | 서버에서 결과 후처리 |
| 가격대 (₩ ~ ₩₩₩₩) | `priceLevels` |
| 지금 영업 중 | `openNow` |
| 거리 (현재 위치/숙소 기준 반경) | `locationBias` / `locationRestriction` |
| 정렬: 추천순 | **가중 평점** = (v·R + m·C)/(v+m) — 리뷰 3개짜리 5.0점이 리뷰 2,000개짜리 4.6점보다 위에 오지 않게 (v=리뷰 수, R=평점, C=전체 평균, m=50 ⚠️) |
| 정렬: 평점순 / 리뷰 많은 순 / 거리순 | 클라이언트 |

### 4.3 화면 (S-19 장소 찾기)
```
┌────────────────────────────────┐
│ ← 장소 찾기   [도쿄 신주쿠 ▾]    │
│ 🔍 라멘                         │
│ [🏨숙소][🍜음식점][☕카페][🏯볼거리]│
│ ⭐4.0+ ▾  리뷰100+ ▾  ₩₩ ▾  영업중 │
│ 정렬: 추천순 ▾      [지도|리스트] │
├────────────────────────────────┤
│ 이치란 라멘 신주쿠점              │
│ ⭐ 4.4 (3,210) · ₩₩ · 영업 중     │
│ 라멘 · 숙소에서 450m              │
│ [+ 일정에 추가]  [길찾기]         │
├────────────────────────────────┤
│ ...                             │
│              Powered by Google  │
└────────────────────────────────┘
```
- 상세 시트: 사진(선택, 별도 과금 ⚠️), 평점 분포 없음(API 미제공), 리뷰 5개(작성자·날짜·별점·본문), 영업시간, 전화, 웹사이트, [구글 지도에서 리뷰 더 보기].

### 4.4 일정 입력 장소 자동완성 (2026-10-22 사용자 요청, 18단계)
- S-11 장소 칸: Google Autocomplete(New) + 네이버 지역 검색을 합쳐 유사도 순 드롭다운. 항목 = 제목 / 작은 주소 / 오른쪽 지도 버튼
- 선택 시 Place Details(필요 필드만): 좌표·주소·`regularOpeningHours` → 일정 시간과 비교해 "이 시간엔 문을 닫아요" 경고
- 영업시간은 Google만 제공 (네이버 검색 API 응답: 이름·카테고리·주소·좌표뿐). 영업시간·평점은 저장하지 않음 (§2.1)

## 5. 길찾기 (현재 위치 → 목적지)
### 5.1 방식: 지도 앱 딥링크 (무료, P0)
`origin`을 생략하면 지도 앱이 **현재 위치를 출발지로** 사용한다. 따라서 위치 권한 없이도 동작한다.

| 제공자 | 형태 | 예시 |
|---|---|---|
| Google (앱/웹 공통) | Maps URLs | `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&destination_place_id={placeId}&travelmode=transit` (`driving`/`walking`/`bicycling`/`transit`) |
| 네이버 (앱) | URL 스킴 | `nmap://route/public?dlat={lat}&dlng={lng}&dname={이름}&appname={웹앱 도메인}` (`route/car`, `route/walk`, `route/bicycle`) |
| 네이버 (앱 미설치 시) | 웹 | 네이버 지도 웹 길찾기 URL ⚠️ (공식 문서화되지 않은 형식 → 개발 시 검증, 실패하면 장소 검색 URL로 대체) |
| 카카오 (선택) | URL 스킴 | `kakaomap://route?ep={lat},{lng}&by=PUBLICTRANSIT` |

- 구현: `buildDirectionsUrl({ provider, mode, dest: { lat, lng, name, placeId } })` 순수 함수 + 단위 테스트.
- 앱 스킴 실패 대비: 스킴 호출 후 일정 시간 안에 페이지가 숨겨지지 않으면 웹 URL로 이동 (iOS/Android 차이는 E2E 수동 검증).
- 버튼 UI: [길찾기 ▾] → 대중교통 / 도보 / 자동차 · 구글 / 네이버 선택 (마지막 선택 기억).

### 5.2 현재 위치 사용 (P1)
- `navigator.geolocation` (HTTPS 필수, 사용자 권한).
- 용도: 지도에 내 위치 표시, 장소까지 직선거리, "내 주변 검색".
- **위치는 서버로 보내지 않는다.** 단, "내 주변 검색"은 검색 요청에 좌표가 포함됨 → 서버에서 저장·로그하지 않음(좌표 로그 마스킹), 소수점 3자리(약 100m)로 반올림 후 전송.

### 5.3 앱 내 경로 미리보기 (P2)
- 해외: Google Routes API (유료) / 국내: 네이버 Directions 5 (자동차만). 비용 대비 효용이 낮아 보류.

## 6. API 키 · 비용 관리
### 6.1 키 구성
| 키 | 위치 | 제한 |
|---|---|---|
| Google 브라우저 키 | 웹앱 | **HTTP 리퍼러 = 내 도메인만**, API 제한 = Maps JavaScript API만 |
| Google 서버 키 | 홈 서버 `.env` | API 제한 = Places API (New) (+Routes), 브라우저에 절대 노출 안 함 |
| 네이버 Maps Client ID | 웹앱 | 콘솔에 **Web 서비스 URL 등록** (도메인 제한) |
| 네이버 검색 API ID/Secret | 홈 서버 `.env` | — |

### 6.2 Google Places (New) 요금 구조 (조사 시점 기준, 재확인 필요)
| SKU | 포함 필드 예 | 월 무료 사용량 | 무료 초과 시 1,000건당 (첫 구간) |
|---|---|---|---|
| Place Details Essentials | 주소, 좌표 | 10,000 | $5 |
| Place Details Enterprise | 평점, 리뷰 수, 영업시간, 전화 | (공식 확인) | $20 |
| Place Details Enterprise + Atmosphere | **리뷰 본문** 등 | 1,000 | $25 |
| Text/Nearby Search Enterprise | 검색 결과에 평점 포함 | (공식 확인) | $35 |
| Text/Nearby Search Enterprise + Atmosphere | — | (공식 확인) | $40 |

→ **평점·리뷰는 가장 비싼 등급**이므로 다음 원칙을 지킨다:
1. 검색 목록은 평점·리뷰 수까지만 (Enterprise). **리뷰 본문은 상세 화면을 열 때만** (Enterprise + Atmosphere).
2. 사용자별 일일 한도 (검색 50회, 상세 30회 ⚠️), Google Cloud에서 **API별 일일 쿼터 상한 + 예산 알림** 설정.
3. 검색 입력은 디바운스 + "검색" 버튼 방식 (입력할 때마다 자동완성 호출하지 않음 — 자동완성도 과금).
4. 서버 메모리 캐시 수 분 (같은 검색 반복 방지, 약관 범위 내).

### 6.3 네이버
- NAVER Cloud Maps는 2025년 요금·무료 이용량 정책이 변경됨(신규 Maps 상품 신청 필요, 무료 이용량은 대표 계정 기준) → **콘솔에서 현재 요금 확인 후 확정** ⚠️.
- 검색 API(developers.naver.com)는 일일 호출 한도 내 무료(지역 검색 결과 최대 5개).

## 7. 데이터 모델 변경 (04-data-model 반영)
```ts
// ItineraryItem.place 확장
place?: {
  name?: string; address?: string;                  // 사용자 소유 값 (편집 가능)
  coords?: { lat: number; lng: number };
  coordsSource?: "user" | "google" | "naver";
  coordsFetchedAt?: string;                         // google이면 30일 지나면 갱신
  googlePlaceId?: string;                           // 영구 저장 허용
  naverPlaceUrl?: string;                           // 네이버 지도 링크
  externalUrl?: string;
};
```
- 평점·리뷰는 **저장하지 않음** (조회 시 실시간).

## 8. 테스트
- `buildDirectionsUrl` 제공자 × 이동수단 × (좌표/placeId 유무) 조합 단위 테스트.
- 서버 places 프록시: Google/네이버 응답 fixture로 변환 테스트, 한도 초과 시 429, FieldMask 고정 검증.
- 실제 기기 수동 테스트: iOS Safari/PWA, Android Chrome에서 네이버·구글 앱 설치/미설치 각각.
