#!/usr/bin/env bash
# CI 한 단계 실행: 실패하면 마지막 출력 줄을 GitHub 주석(::error)으로 남긴다.
# 주석은 로그인 없이도 실행 화면에 보이므로, 어디서 깨졌는지 바로 알 수 있다 (2026-10-27)
# 사용: scripts/ci-step.sh "이름" 명령...
set -o pipefail
name="$1"
shift
log="$(mktemp)"
if "$@" 2>&1 | tee "$log"; then
  exit 0
fi
# 색 코드 빼고, 오류처럼 보이는 줄 위주로 최대 30줄
sed 's/\x1b\[[0-9;]*m//g' "$log" \
  | grep -E -i 'error|fail|×|✗|✖|expected|received|TS[0-9]{4}|warn' \
  | tail -n 30 \
  | while IFS= read -r line; do
      # 주석 한 줄 형식: 줄바꿈·% 는 이스케이프
      esc="${line//'%'/'%25'}"
      echo "::error title=${name}::${esc}"
    done
exit 1
