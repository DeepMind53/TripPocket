# 코딩 규칙

## 1. 네이밍
| 대상 | 규칙 | 예 |
|---|---|---|
| 컴포넌트 파일/이름 | PascalCase | `DayTabs.tsx`, `ItemEditSheet.tsx` |
| 훅 | `use` + camelCase | `useTripItems.ts` |
| 일반 모듈 | camelCase | `fractionalIndex.ts` |
| 타입/Zod 스키마 | `Trip` 타입, `TripSchema` 스키마 | — |
| 상수 | UPPER_SNAKE | `MAX_SHARE_URL_BYTES` |
| 테스트 | 대상 옆 `*.test.ts(x)` | `settleUp.test.ts` |
| i18n 키 | `feature.screen.element` | `itinerary.edit.titleLabel` |

## 2. TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- `any` 금지, `as` 단언 최소화. 외부 입력은 반드시 Zod `parse`.
- 유니온은 discriminated union + `switch` 완전성 검사(`assertNever`).
- `enum` 대신 문자열 리터럴 유니온 + `as const`.

## 3. React
- 함수형 컴포넌트만. 컴포넌트는 표시에 집중, 로직은 hook/domain으로.
- 컴포넌트 150줄 넘으면 분리 검토.
- `useEffect`로 파생 상태 만들지 않기 (계산은 렌더 중 / `useMemo`).
- 리스트 key는 항상 엔티티 `id`.
- 무거운 화면(지도, 차트)은 `React.lazy`.
- Enter로 저장·추가할 때는 `shared/lib/keys.ts`의 `isSubmitEnter(e)`만 쓴다 — 한글 조합 중 Enter를 빼야 글자가 남거나 두 번 저장되지 않는다 (docs/31 R4).
- 입력 시트는 처음 값과 다르면 `useSheetDirty(dirty)`(시트 안 양식) 또는 `<BottomSheet dirty>`로 알린다 — 닫을 때 "버릴까요?"를 묻는다 (docs/31 A1). 시트 안 [취소]는 `CancelSaveRow`를 쓰면 같은 규칙.

## 4. 데이터 접근
- 컴포넌트 → feature hook → repository → Dexie. **컴포넌트에서 `db.` 직접 사용 금지.**
- repository는 쓰기 시 반드시: Zod 검증 → `updatedAt` 갱신 → 필요 시 `db.transaction`.
- 삭제는 기본 소프트 삭제(`deletedAt`). 조회 함수는 기본적으로 `deletedAt` 없는 것만 반환.

## 5. 날짜·시간
- 일정 날짜/시간은 `LocalDate`/`LocalTime` 문자열. `new Date("2026-10-25")` 같은 파싱 금지 (UTC로 해석되어 하루 밀림).
- 날짜 계산은 `src/domain/date/`의 함수만 사용.

## 6. 스타일
- Tailwind 유틸리티 우선. 반복되는 조합은 컴포넌트로 추출 (`@apply` 남용 금지).
- 색/간격은 디자인 토큰만 사용 (임의 값 `[13px]` 지양).
- 모바일 우선: 기본 클래스 = 모바일, `md:` 이상에서 확장.

## 7. 접근성
- 아이콘 버튼은 `aria-label` 필수 (i18n).
- 드래그 기능은 키보드/메뉴 대체 수단 제공.
- 포커스 이동: 시트 열릴 때 첫 입력, 닫힐 때 트리거로 복귀.

## 8. 주석 / 문서
- "무엇"이 아닌 "왜"를 주석으로. 한국어 가능.
- 공개 domain 함수는 짧은 JSDoc.
- 구조/결정 변경 시 `docs/` 갱신을 같은 PR에 포함.

## 9. 의존성
- 새 패키지 추가 전: 번들 크기(bundlephobia), 유지보수 상태, 오프라인 영향 확인 후 합의.
- 버전은 lockfile로 고정, 정기적으로 일괄 업데이트.
