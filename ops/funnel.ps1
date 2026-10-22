# Tailscale Funnel로 홈 서버를 인터넷에 연다 (무료, 고정 주소 https://<컴퓨터>.<tailnet>.ts.net — ADR-0006)
# 먼저: https://tailscale.com/download 설치 → 로그인 → 관리 화면에서 Funnel 허용 (ops/README.md 2절)
#   powershell -ExecutionPolicy Bypass -File D:\Travel_Planner\ops\funnel.ps1
$ErrorActionPreference = 'Stop'
if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
  throw 'tailscale 이 없어요. https://tailscale.com/download 에서 설치하세요.'
}
# 443(HTTPS) → 이 PC의 127.0.0.1:8787. --bg: PC를 다시 켜도 유지
tailscale funnel --bg 8787
tailscale funnel status
Write-Host ''
Write-Host '위 https://...ts.net 주소를 Cloudflare Pages 환경 변수 TP_SERVER_URL 에 넣으세요 (docs/deploy.md 2-1절).'
Write-Host '이 주소로 직접 /api 를 부르면 404 가 정상입니다 (Pages 프록시의 비밀 헤더가 있어야 응답).'
