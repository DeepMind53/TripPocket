# 트립포켓에서 ui-ux-pro-max 쓰는 법 (2026-11-09)

- 출처: github.com/nextlevelbuilder/ui-ux-pro-max-skill `.claude/skills/ui-ux-pro-max` (MIT, `LICENSE`). 테스트·`validate_data.py`는 넣지 않았다
- 스크립트는 파이썬 표준 라이브러리만 쓰고 인터넷 연결이 없다 (2026-11-09 확인). 이 프로젝트에서는 경로를 이렇게 쓴다:
  `python .claude/skills/ui-ux-pro-max/scripts/search.py "<검색어>" --domain <domain>` (`${CLAUDE_PLUGIN_ROOT}` 대신 저장소 루트)
- `--persist`로 파일을 만들지 않는다 (기준 문서는 `docs/11`·`docs/29`)
- 쓰는 곳: docs/29 §13 1단계 토큰 대조 한 번 (느리고 토큰을 많이 씀)
- 우선순위: 사용자 결정 > docs/29 > docs/11 §13(unslop) > 다른 스킬
