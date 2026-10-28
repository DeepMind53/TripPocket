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
# 색 코드 빼고, 실패한 시험 이름(›)과 오류처럼 보이는 줄 위주로 최대 40줄을 주석 하나로 모은다
# (GitHub은 단계마다 주석을 10개까지만 보여 줘서, 줄마다 따로 남기면 뒤쪽 실패가 잘린다 — 2026-10-28)
body="$(sed 's/\x1b\[[0-9;]*m//g' "$log" \
  | grep -E -i '›|error|fail|×|✗|✖|expected|received|TS[0-9]{4}' \
  | grep -v -E '^\[WebServer\]|chunkSizeWarningLimit' \
  | tail -n 40)"
esc="${body//'%'/'%25'}"
esc="${esc//$'\r'/}"
esc="${esc//$'\n'/'%0A'}"
echo "::error title=${name}::${esc}"
exit 1
