# 테스트 전략

## 피라미드
| 레벨 | 도구 | 대상 | 목표 |
|---|---|---|---|
| 단위 | Vitest | `domain/` 순수 함수 (날짜, 정렬, 거리, 딥링크 생성) | 커버리지 90%+ |
| 통합 | Vitest + fake-indexeddb | `data/` repository, 마이그레이션, 백업 import/export | 80%+ |
| 컴포넌트 | Vitest + Testing Library | 복잡한 폼/시트 (선택) | 필요한 것만 |
| E2E | Playwright (iPhone 13 / Pixel 7 뷰포트) | 핵심 사용자 흐름 | 마일스톤별 시나리오 |

## 반드시 테스트할 것
- 타임존/날짜 경계: 여행지와 기기 타임존이 다를 때, 월말·윤년, 자정 넘는 일정
- 길찾기 딥링크: 제공자 × 이동수단 × 한글 장소명 인코딩
- fractional index: 연속 삽입 1,000회 후 정렬 유지
- 마이그레이션: v(N-1) 데이터 → vN 업그레이드 결과
- 백업 왕복: export → clear → import → deep equal
- 손상/악의적 백업 파일: 거부되고 기존 데이터 영향 없음

## E2E 공통
- 매 테스트는 깨끗한 브라우저 컨텍스트 (IndexedDB 격리).
- 오프라인 테스트: `context.setOffline(true)` 후 새로고침 → 앱 로드 확인 (프로덕션 빌드 `preview` 대상으로 실행).
- 선택자는 `getByRole` / `getByLabel` 우선, `data-testid`는 최후 수단.

## 테스트 작성 규칙
- 이름: `it("기간을 줄이면 범위 밖 아이템을 위시리스트로 옮긴다")` — 한국어 서술 허용.
- 현재 시각 의존 로직은 `today`를 인자로 주입 (테스트에서 고정).

## 푸시 전 검사 (2026-11-17, 버그 줄이기 ④)
- `pnpm check`는 린트·타입·단위 시험만 돈다. 배포 빌드 시험(오프라인·보안 정책, `*.prod.spec.ts`)은 CI에서만 돌아서,
  화면 주소가 바뀐 것을 이틀 동안 몰랐다 (`docs/bugs.md` B2).
- 화면 주소·서비스 워커·보안 정책을 건드렸거나 큰 변경을 푸시하기 전에는 `pnpm check:full`
  (포맷 + check + 배포 빌드 시험 Chromium, 약 2~3분).
- 시트처럼 "무엇을 대상으로 열렸나"가 있는 화면 상태는 새로고침 뒤 복원까지 E2E로 확인한다 (`sheet-restore.spec.ts`).
- 서버 호출은 `data/api/client.ts`의 `api()`로 — 예외를 던지지 않으므로(본문이 깨져도 결과로) 화면 로딩 표시가 늘 끝난다.
  같은 검색을 연달아 부를 수 있는 화면은 마지막 요청만 반영한다 (`PlacesPage`의 `seq`, `PlaceAutocomplete`의 `alive`).
