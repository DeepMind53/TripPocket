# Git 워크플로

## 브랜치
- `main`: 항상 배포 가능 상태. 머지 시 자동 배포.
- 작업 브랜치: `feat/itinerary-dnd`, `fix/date-offset`, `docs/adr-0003`, `chore/eslint`
- 작은 단위로 자주 머지 (브랜치 수명 1~2일 권장).

## 커밋 메시지 (Conventional Commits, 영어)
```
<type>(<scope>): <summary>

[body: 왜 바꿨는지]
```
- type: `feat` `fix` `docs` `refactor` `test` `chore` `perf` `style` `build` `ci`
- scope: `trips` `itinerary` `bookings` `checklist` `places` `sync` `server` `data` `domain` `pwa` `ui` ...
- 예: `feat(itinerary): reorder items with drag and drop`
- 스키마 변경 커밋은 본문에 `DB: v1 → v2` 명시.

## PR 체크리스트
- [ ] lint / typecheck / test 통과
- [ ] 360px 모바일에서 확인 (스크린샷 첨부 권장)
- [ ] 오프라인 모드에서 확인 (해당 시)
- [ ] 스키마 변경 시 마이그레이션 + 테스트
- [ ] 문서/ADR 갱신 (해당 시)

## 버전
- SemVer. `0.x` 동안은 마일스톤 완료마다 minor 증가 (`0.1.0` = M1).
- `CHANGELOG.md`는 M1 완료 시점부터 작성.
