# 문서 목록 — 무엇을 언제 읽나

> 2026-11-12 만듦 (사용자 요청: 문서·아키텍처를 앞으로도 관리하기 쉽게). 문서를 더하거나 상태가 바뀌면 이 표도 고친다 (월간 갱신 G3).
> 상태: **현행** = 지금 코드·규칙의 기준 / **기록** = 그때의 설계·결정 과정 (지금과 다를 수 있음, 현행 문서가 우선) / **보류** = 사용자 결정 대기·구현 안 함

## 작업 시작 순서 (새 세션)

1. `CLAUDE.md` — 절대 규칙
2. `PROGRESS.md` — 지금 상태, 다음에 할 일, 사용자 피드백
3. [`code-map.md`](code-map.md) — **코드를 고칠 때 어디를 보나** (폴더·자주 하는 수정·주요 흐름·외부 API 표)
4. [`03-architecture.md`](03-architecture.md) — 전체 구조와 왜 그렇게 했나 (그림 + 규칙)
5. 하려는 일의 현행 문서 (아래 표) · 결정 대기 [`08-open-decisions.md`](08-open-decisions.md) · 확정 결정 [`adr/`](adr/)

## 문서

| 문서 | 내용 | 상태 |
|---|---|---|
| [code-map](code-map.md) | 실제 구조·수정 위치·외부 API 무료 사용량 표 | **현행** |
| [03 아키텍처](03-architecture.md) | 전체 구조·스택·레이어·데이터 흐름·오프라인·보안·성능 | **현행** |
| [deploy](deploy.md) | 배포·키 등록 절차 | **현행** |
| [conventions/](conventions/) | 코딩 규칙·커밋·테스트 | **현행** |
| [08 결정 필요 항목](08-open-decisions.md) | 아직 안 정한 것 — 임의로 정하지 말고 묻는다 | **현행** |
| [adr/](adr/) 0001~0012 | 확정 결정 (바꾸려면 새 ADR) | **현행** |
| [22 반복 작업](22-recurring-tasks.md) | 월간 갱신 목록 (앱 안 요청문과 같은 번호) | **현행** |
| [09 서버·로그인·보안](09-server-auth-security.md) | 보안 점검표 §7 (로그인은 지금 카카오·Google) | **현행** (점검표) · 나머지 기록 |
| [10 지도·장소](10-maps-places.md) | Google 장소 표시 규칙 §2.1 | **현행** (§2.1) · 나머지 기록 |
| [11 디자인 시스템](11-design-system.md) | 토큰·unslop 체크리스트 §13 | **현행** |
| [29 디자인 개편 "여행 노선"](29-design-renewal.md) | 노선·탑승권·다음 역 카드·도장 부품과 화면별 배치 | **현행** |
| [12 빠른 메뉴·설정·환율](12-quick-menu-settings-fx.md) | 설정 컨트롤 원칙 §3.1, 환율은 계산만 | **현행** (§3.1) |
| [14 AI 추천](14-ai-recommendations.md) | 근거 있는 장소만 §5, AI 입력 제한 §8 | **현행** (§5·§8) |
| [17 후기·포인트](17-reviews-points.md) | | **현행** (구현됨) |
| [19 나라별 필수 항목](19-entry-checklist.md) | | **현행** (구현됨) |
| [23 유료 API 대체](23-paid-api-fallbacks.md) | 무료량이 끝나면 대체 API·기능 | **현행** (구현됨) |
| [24 여행지 특보](24-weather-disaster-alerts.md) | | **현행** (구현됨, ADR-0008) |
| [26 무료 API 더 쓰기](26-free-apis.md) | | 현행 (1~3단계) · 일부 보류 |
| [27 여행 모드 v2](27-travel-mode-v2.md) | | 현행 (1~4단계) · 5단계 이후 보류 |
| [28 숙소 최저가](28-lodging-price-compare.md) | | **현행** (ADR-0010) |
| [21 유료 서비스](21-paid-services.md) | 막힐 때 고를 유료 서비스 가격 | 참고 |
| [01 PRD](01-product-requirements.md) · [02 벤치마크](02-benchmark.md) · [04 데이터 모델](04-data-model.md) · [05 화면](05-screens-ux.md) · [06 저장·백업·공유](06-storage-backup-sharing.md) · [07 로드맵](07-roadmap.md) | 처음 설계 (2026-10-22) | 기록 — 실제 스키마는 `packages/shared/src/schema`, 화면은 코드 |
| [13 설계 점검](13-design-review.md) · [15 구현 단계](15-implementation-steps.md) · [16 UX 개선](16-ux-ui-improvements.md) · [20 문구·UX 점검](20-copy-ux-gap-review.md) · [25 여행 모드](25-travel-mode.md) | 끝난 계획·점검 | 기록 |
| [18 예약 자동 채우기](18-booking-import.md) | | 보류 (사용자 결정: 미적용) |
| [30 기종·좌석 안내](30-aircraft-seats.md) | | 보류 (사용자 결정) |
| [design/](design/) | 시안 자료 | 기록 |

## 문서 관리 규칙

- **코드를 바꾸면 같은 커밋에서** `code-map.md`(위치·흐름)를 고친다. 구조가 바뀌면 `03-architecture.md`도
- 새 결정 → `adr/`에 ADR + `08`에서 '확정'으로. 새 설계 문서는 다음 번호(31~)로 만들고 이 표에 상태와 함께 넣는다
- 구현이 끝난 설계 문서는 첫머리 "상태"를 고치고 이 표에서 현행/기록을 정한다 — 첫머리가 "설계만"인데 구현된 채로 두지 않는다
- 매일의 진행은 `PROGRESS.md`에 짧게 (긴 설명은 해당 문서로)
