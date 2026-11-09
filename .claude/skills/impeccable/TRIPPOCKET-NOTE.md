# 트립포켓에서 Impeccable 쓰는 법 (2026-11-09)

- 이 폴더에는 `SKILL.md`, `reference/*.md`, `LICENSE`(Apache 2.0), `NOTICE.md`만 넣었다. 출처: github.com/pbakaus/impeccable `.claude/skills/impeccable` (v4.8.1)
- `scripts/`(엔진 실행 파일·브라우저 코드·글꼴 목록)는 **넣지 않았다** — 실행 파일을 따로 받아 돌리는 구조라 사용자 확인 범위 밖 (docs/29 §14, ADR-0011)
- 그래서 `SKILL.md`의 `scripts/impeccable …` 명령, 훅(`hooks`), `live`, `pin`은 **실행하지 않는다**. `reference/`의 기준(audit·critique·polish·quieter·typeset·layout 등)만 읽고 판단에 쓴다
- PRODUCT.md·DESIGN.md를 만들라는 안내도 따르지 않는다 — 이 프로젝트의 기준은 `docs/11-design-system.md`·`docs/29-design-renewal.md`
- 우선순위: 사용자 결정 > docs/29 > docs/11 §13(unslop) > 다른 스킬. 기능을 빼거나 바꾸자는 제안은 따르지 않는다
