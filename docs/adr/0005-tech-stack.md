# ADR-0005: 기술 스택 확정

- 상태: 확정
- 날짜: 2026-10-22 (0단계 결정)

## 배경
1단계 스캐폴딩 전에 웹·서버·공용 패키지의 기술 스택을 확정해야 한다. 후보와 이유는 `03-architecture.md` §2, `08-open-decisions.md` B 그룹 참고.

## 결정
| 영역 | 선택 |
|---|---|
| 언어 | TypeScript (strict) |
| 패키지 매니저 / 구조 | pnpm workspaces 모노레포 — `apps/web`, `apps/server`, `packages/shared` (패키지 이름 `@trippocket/*`) |
| 웹 빌드 | Vite |
| UI | React |
| 라우팅 | React Router |
| 스타일 | Tailwind CSS + 필요한 Radix UI 프리미티브만 |
| 아이콘 | lucide-react |
| 로컬 DB | Dexie.js (IndexedDB) |
| 검증 | Zod (웹·서버 공용, `packages/shared`) |
| UI 임시 상태 | Zustand |
| 폼 | React Hook Form + Zod |
| 날짜 | date-fns + Intl |
| 드래그 | dnd-kit |
| PWA | vite-plugin-pwa (Workbox) |
| i18n | i18next (한국어 우선) |
| 서버 | Node.js 24 LTS + Fastify |
| 서버 DB | SQLite (WAL) + Drizzle ORM |
| ID | UUID v7 |
| 폰트 | Pretendard (셀프 호스팅 서브셋) |
| 테스트 | Vitest + Testing Library + fake-indexeddb, Playwright |
| 코드 품질 | ESLint (flat config) + typescript-eslint + Prettier, Husky + lint-staged |
| 호스팅 | 웹: Cloudflare Pages / API: 홈 PC + Cloudflare Tunnel |

- TypeScript는 **6.0.x로 고정**(`~6.0.3`): TypeScript 7은 typescript-eslint가 아직 지원하지 않음 (peer `<6.1.0`, 2026-10-22 확인). 지원되면 별도 단계에서 올린다.
- 각 라이브러리의 정확한 버전은 1단계에서 설치 시점 기준 최신 안정 버전으로 고정(lockfile)한다.
- 4단계 추가: 검증은 번들 크기를 위해 **`zod/mini`** 사용, Dexie 반응형 조회용 `dexie-react-hooks`(Dexie 공식).
- 위 목록에 없는 의존성 추가는 CLAUDE.md 규칙대로 사용자 확인 후 진행.

## 결과
- 웹·서버가 한 언어(TypeScript)와 한 검증 스키마(Zod)를 공유한다.
- 단계별 설치: 1단계는 웹 기본 + 품질 도구만, 나머지 라이브러리는 그 기능을 만드는 단계에서 추가한다 (예: dnd-kit은 7단계, vite-plugin-pwa는 11단계, Fastify는 13단계).
