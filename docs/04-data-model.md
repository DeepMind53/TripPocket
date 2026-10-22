# 04. 데이터 모델

- 저장소: IndexedDB (Dexie). DB 이름 `travel-planner`.
- 모든 타입은 `src/domain/types/`에 **Zod 스키마**로 정의하고 `z.infer`로 TS 타입을 만든다 (단일 정의).

## 1. 공통 규칙
| 규칙 | 내용 |
|---|---|
| ID | `string` UUID v7 (`crypto.randomUUID()`는 v4 → 정렬성 위해 v7 유틸 사용 ⚠️ 또는 v4 허용) |
| 타임스탬프 | `createdAt`, `updatedAt`: ISO 8601 UTC 문자열 (`2026-10-22T09:00:00.000Z`) |
| 소프트 삭제 | `deletedAt?: string` — 휴지통/실행취소 및 동기화 툼스톤. 서버 반영 확인 후 30일 뒤 영구 삭제 |
| 동기화 | `rev?: number`(서버 부여), 로컬 전용 `dirty: 0 \| 1` — 상세 `09-server-auth-security.md` §6 |
| 소유권 | 서버의 `trip_members`로 관리. 클라이언트 엔티티에는 userId를 저장하지 않음 |
| 로컬 날짜 | `LocalDate = "YYYY-MM-DD"` (여행지 기준 달력 날짜, 타임존 없음) |
| 로컬 시간 | `LocalTime = "HH:mm"` |
| 타임존 | IANA 문자열 (`Asia/Tokyo`). 항공처럼 출발/도착 타임존이 다를 때만 필수 |
| 정렬 | `order: string` — **fractional indexing** (드래그 시 한 행만 갱신) |
| 좌표 | `{ lat: number; lng: number }` 선택 |

> 왜 Date 객체/타임스탬프로 일정 시간을 저장하지 않나?
> 여행 일정 "10/25 09:00 도쿄"는 사용자의 휴대폰 타임존이 바뀌어도 **그 현지 시각 그대로** 보여야 한다.
> 그래서 현지 날짜·시간 문자열 + (필요 시) 타임존으로 저장한다.

## 2. ERD
```
Trip 1───* Day(파생, 저장 안 함)
 │
 ├──* ItineraryItem ──0..1 Booking
 ├──* Booking
 ├──* ChecklistItem
 └──* Attachment (Blob) ── (ItineraryItem | Booking)

SavedPlace (여행과 무관한 '저장한 장소'), AppSetting (key-value), ChecklistTemplate (사용자 템플릿)
※ 가계부(Expense/Traveler) 엔티티는 범위 제외 (2026-10-22). 공동 편집 멤버는 서버 trip_members로 관리.
```
- **Day는 저장하지 않는다.** `Trip.startDate~endDate`에서 계산. 아이템은 `date: LocalDate | null`(null = 위시리스트)로 소속 Day를 가진다.
  → 기간 변경 시 Day 레코드 동기화 문제가 없음. Day별 메모가 필요하면 `DayNote` 테이블 추가 ⚠️.

## 3. 엔티티 정의

### Trip
```ts
type Trip = {
  id: string;
  title: string;                 // "도쿄 가을여행"
  destinations: string[];        // ["도쿄", "하코네"] 자유 텍스트
  startDate: LocalDate;
  endDate: LocalDate;            // startDate 이상
  timezone: string;              // 기본 여행지 타임존 (기본값: 기기 타임존)
  cover: { emoji?: string; color?: string };
  memo?: string;
  archivedAt?: string;
  createdAt; updatedAt; deletedAt?;
};
```

### ItineraryItem (일정 아이템)
```ts
type ItemKind = "place" | "food" | "cafe" | "shopping" | "transport" | "lodging" | "activity" | "note";

type ItineraryItem = {
  id: string;
  tripId: string;
  date: LocalDate | null;        // null = 위시리스트(미배정)
  order: string;                 // 같은 date 내 정렬 키
  kind: ItemKind;
  title: string;
  startTime?: LocalTime;
  endTime?: LocalTime;
  timezone?: string;             // 없으면 Trip.timezone
  place?: {
    name?: string;
    address?: string;
    coords?: { lat: number; lng: number };
    externalUrl?: string;        // 구글맵/네이버 링크 등
    coordsSource?: "user" | "google" | "naver";
    coordsFetchedAt?: string;    // google 좌표는 30일 지나면 재조회 (약관)
    googlePlaceId?: string;      // 영구 저장 허용
    naverPlaceUrl?: string;
    // 평점·리뷰는 저장하지 않는다 (10-maps-places.md §2.1)
  };
  transport?: {                  // kind === "transport"
    mode: "walk" | "subway" | "bus" | "train" | "taxi" | "car" | "ferry" | "flight" | "other";
    from?: string; to?: string;
  };
  bookingId?: string;            // 연결된 예약
  url?: string;
  memo?: string;
  done?: boolean;                // 여행 중 "다녀옴" 체크
  createdAt; updatedAt; deletedAt?;
};
```
정렬 규칙(표시): `startTime` 있는 아이템은 시간순, 없는 아이템은 `order`순 — ⚠️ **확정 필요**
(제안: 순서는 항상 `order`가 기준, 시간 입력 시 "시간순 자동 정렬" 버튼 제공. 드래그 결과가 시간 때문에 튀지 않게.)

### Booking (예약)
```ts
type BookingKind = "flight" | "lodging" | "train" | "car" | "tour" | "ticket" | "other";

type Booking = {
  id: string;
  tripId: string;
  kind: BookingKind;
  title: string;                 // "KE703 인천→나리타", "신주쿠 OO호텔"
  confirmationNo?: string;
  provider?: string;             // 항공사/예약사이트
  start: { date: LocalDate; time?: LocalTime; timezone?: string; place?: string };
  end?:   { date: LocalDate; time?: LocalTime; timezone?: string; place?: string };
  details?: {                    // kind별 선택 필드 (discriminated union으로 구현)
    flightNo?: string; seat?: string; terminal?: string;   // flight
    address?: string; phone?: string; roomType?: string;   // lodging
  };
  priceNote?: string;            // "결제 완료 ₩320,000" 같은 자유 메모 (금액 계산 기능 없음)
  memo?: string;
  createdAt; updatedAt; deletedAt?;
};
```
- 숙소 Booking은 `start.date ≤ d < end.date`인 모든 Day 하단에 "숙소" 카드로 **파생 표시**.
- 항공 Booking은 생성 시 출발일 Day에 `ItineraryItem(kind: transport, bookingId)` 자동 생성 ⚠️ (또는 파생 표시만).

### ChecklistItem
```ts
type ChecklistItem = {
  id; tripId;
  list: "packing" | "todo";
  category?: string;             // "의류", "전자기기", "서류"
  text: string;
  checked: boolean;
  order: string;
  createdAt; updatedAt; deletedAt?;
};
```

### SavedPlace (저장한 장소 — 앱 하단 '저장' 탭)
```ts
type SavedPlace = {
  id: string;
  name: string;
  kind: ItemKind;
  address?: string;
  coords?: { lat: number; lng: number };
  coordsSource?: "user" | "google" | "naver";
  coordsFetchedAt?: string;
  googlePlaceId?: string;
  naverPlaceUrl?: string;
  cityTag?: string;              // "도쿄" — 여행 만들 때 같은 도시 장소 추천
  memo?: string;
  createdAt; updatedAt; deletedAt?;
};
```
- 여행 안의 "가고 싶은 곳"은 `ItineraryItem(date: null)`, 여행과 무관한 찜은 `SavedPlace`. [여행에 담기] 시 복사.

### Attachment (P1)
```ts
type Attachment = {
  id; tripId;
  ownerType: "item" | "booking";
  ownerId: string;
  name: string; mimeType: string; size: number;
  blob: Blob;                    // IndexedDB에 Blob 직접 저장
  thumbnail?: Blob;
  createdAt; deletedAt?;
};
```

### AppSetting (key-value)
`locale`, `theme`, `timeFormat`("24h"|"12h"), `lastBackupAt`, `persistGranted`, `installPromptDismissedAt`, `mapApp`("google"|"naver"|"kakao"|"apple") 등.

## 4. Dexie 스키마 (v1 초안)
```ts
db.version(1).stores({
  trips:          "id, startDate, updatedAt, deletedAt",
  items:          "id, tripId, [tripId+date], updatedAt, deletedAt, dirty",
  bookings:       "id, tripId, [tripId+kind], updatedAt, deletedAt",
  savedPlaces:    "id, cityTag, updatedAt, deletedAt",
  checklistItems: "id, tripId, [tripId+list]",
  attachments:    "id, tripId, [ownerType+ownerId]",
  checklistTemplates: "id",
  settings:       "key",
  syncState:      "key",            // lastPulledRev, lastPushAt, accountId
});
// 동기화 대상 테이블 모두 dirty 인덱스 추가 (위는 예시로 items만 표기)
```
- 인덱스에 없는 필드는 저장은 되지만 검색 불가 → 쿼리 패턴이 생기면 인덱스 추가(버전업).

## 5. 마이그레이션 정책
1. 스키마/형태 변경 = `db.version(N+1).stores(...).upgrade(tx => ...)` 추가. **기존 version 블록은 절대 수정하지 않는다.**
2. 각 마이그레이션은 `src/data/migrations/vN.ts`로 분리 + `vN.test.ts`(fake-indexeddb에 v(N-1) 데이터 넣고 업그레이드 검증).
3. 백업 JSON도 `schemaVersion`을 가지며, 가져오기 시 `migrateBackup(json)` 파이프라인으로 최신 형태로 올린 뒤 저장.
4. 데이터를 지우거나 형태를 크게 바꾸는 마이그레이션 직전에는 사용자에게 **백업 파일 다운로드를 먼저 권유**한다. (DB 안에 스냅샷을 복제하면 용량이 두 배가 되므로 지양 ⚠️)

## 6. 파생 계산 (domain/ 순수 함수)
| 함수 | 설명 |
|---|---|
| `getTripDays(trip)` | `LocalDate[]` 생성 |
| `getTripStatus(trip, today)` | upcoming / ongoing / past |
| `groupItemsByDay(items, days)` | Day별 + 위시리스트 |
| `getLodgingForDate(bookings, date)` | 그날 숙소 |
| `between(a, b)` | fractional index 생성 |
| `distanceMeters(a, b)` | 두 좌표 직선거리 (하버사인) — 카드 사이 "직선 800m" 표시 |
| `reflowOnDateChange(trip, newRange, items)` | 기간 변경 시 아이템 이동 계획 (미리보기 → 확인 후 적용) |
