# 트립포켓 (TripPocket)

> 누구나 브라우저에서 바로 쓰는 **오프라인 우선(Offline-first) 여행 일정 정리 웹앱**.
> 로그인 없이도 휴대폰 안에서 바로 쓰고, 로그인하면 **홈 PC 서버**에 동기화·백업된다.
> 구글/네이버 지도, 평점·리뷰 필터 장소 검색, 현재 위치 길찾기, 환율 계산기·AI 추천(빠른 메뉴)을 지원한다.

## 상태

- 2026-10-22: 설계 단계 (코드 없음). 설계 문서 초안 작성 완료.
- 2026-10-22: 요구사항 추가 반영 — 홈 PC 서버 로그인/동기화, 구글·네이버 지도, 평점·리뷰 장소 검색, 길찾기.
- 2026-10-22: 0단계 완료 — 이름 트립포켓, 기술 스택(ADR-0005), 메인 컬러 바다 블루, 내비게이션 확정.
- 다음 단계: 1단계 모노레포 뼈대 ([`PROGRESS.md`](PROGRESS.md) 참고).

## 핵심 컨셉

| 원칙                  | 의미                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| **Optional Account**  | 로그인 없이 로컬 모드로 전부 사용 가능. 로그인 시 홈 PC 서버와 동기화           |
| **Secure by Default** | 비밀번호 미저장(소셜 로그인), 인바운드 포트 0개(Cloudflare Tunnel), 위치 미저장 |
| **Offline-first**     | 비행기 모드·해외 로밍 없이도 100% 동작 (PWA)                                    |
| **Mobile-first**      | 한 손 조작, 여행 중 빠른 조회가 최우선                                          |
| **Data Ownership**    | 언제든 JSON으로 내보내기/가져오기. 잠금 없음                                    |

## 문서 지도

| 문서                                                                   | 내용                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [CLAUDE.md](CLAUDE.md)                                                 | AI 협업 규칙 (Claude가 매 세션 읽는 규칙)                          |
| [docs/01-product-requirements.md](docs/01-product-requirements.md)     | PRD: 목표, 페르소나, 기능 목록, 우선순위                           |
| [docs/02-benchmark.md](docs/02-benchmark.md)                           | 유사 앱 분석 및 차용할 기능                                        |
| [docs/03-architecture.md](docs/03-architecture.md)                     | 기술 스택, 레이어 구조, 폴더 구조                                  |
| [docs/04-data-model.md](docs/04-data-model.md)                         | 엔티티, 스키마, 마이그레이션                                       |
| [docs/05-screens-ux.md](docs/05-screens-ux.md)                         | 화면 목록, 플로우, 와이어프레임                                    |
| [docs/06-storage-backup-sharing.md](docs/06-storage-backup-sharing.md) | 로컬 저장 전략, 백업, 공유                                         |
| [docs/07-roadmap.md](docs/07-roadmap.md)                               | 마일스톤 / 작업 단위                                               |
| [docs/08-open-decisions.md](docs/08-open-decisions.md)                 | **내일 함께 정할 항목**                                            |
| [docs/09-server-auth-security.md](docs/09-server-auth-security.md)     | 홈 서버, 로그인, 동기화, 보안 체크리스트                           |
| [docs/10-maps-places.md](docs/10-maps-places.md)                       | 구글/네이버 지도, 평점·리뷰 검색, 길찾기                           |
| [docs/11-design-system.md](docs/11-design-system.md)                   | 디자인 원칙, 컬러·타이포, 내비게이션, 컴포넌트, 한국어 문구 가이드 |
| [docs/12-quick-menu-settings-fx.md](docs/12-quick-menu-settings-fx.md) | 빠른 메뉴, 환율 계산기, 설정 항목·컨트롤 명세                      |
| [docs/14-ai-recommendations.md](docs/14-ai-recommendations.md)         | AI 추천: 내 근처 맛집·핫플·놀거리 (기간 단계 확장)                 |
| [docs/15-implementation-steps.md](docs/15-implementation-steps.md)     | 단계별 구현 계획 (23단계)                                          |
| [PROGRESS.md](PROGRESS.md)                                             | 진행 상황                                                          |
| [docs/13-design-review.md](docs/13-design-review.md)                   | 설계 점검: 빠진 부분·리스크·추가 결정 사항                         |
| [docs/design/mockups.html](docs/design/mockups.html)                   | 주요 화면 시각 시안 (브라우저로 열기)                              |
| [docs/adr/](docs/adr/)                                                 | 아키텍처 결정 기록 (ADR)                                           |
| [docs/conventions/](docs/conventions/)                                 | 코딩·Git·테스트 규칙                                               |

## 개발

처음 한 번: Node.js 24 이상, `npm install -g pnpm@10` (관리자 권한 없이 사용자 폴더에 설치됨)

```bash
pnpm install          # 의존성 설치
pnpm dev              # 개발 서버 → http://localhost:5173
pnpm check            # lint + typecheck + 단위 테스트 (작업 완료 보고 전 필수)
pnpm e2e              # 브라우저 테스트 (처음 한 번: pnpm --filter @trippocket/web exec playwright install chromium)
pnpm build            # 정적 빌드 (apps/web/dist)
pnpm format           # 코드 형식 정리 (커밋 시 자동 실행)
```

### 폴더

| 경로              | 내용                                                   |
| ----------------- | ------------------------------------------------------ |
| `apps/web`        | 웹앱 (React + Vite)                                    |
| `packages/shared` | 웹·서버 공용 타입·순수 함수 (React/브라우저 의존 금지) |
| `apps/server`     | 홈 PC 서버 (13단계에서 추가)                           |
