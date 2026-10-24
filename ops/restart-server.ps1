# 홈 서버 (다시) 시작 — 바탕화면 "TripPocket 서버 재시작.bat"이 부른다 (사용자 요청 2026-10-25)
# 돌고 있으면 끄고 다시 켜고, 꺼져 있으면 바로 켠다. 부팅 때 자동 시작은 작업 스케줄러 'TripPocket Server' (install.ps1)
$ErrorActionPreference = 'Stop'
$task = 'TripPocket Server'
$port = 8787

function Listening {
  [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue)) {
  throw "작업 '$task'이 없어요. 관리자 PowerShell에서 ops\install.ps1 을 먼저 실행하세요."
}

$running = (Get-ScheduledTask -TaskName $task).State -eq 'Running' -or (Listening)
if ($running) {
  Write-Host '서버가 돌고 있어요 → 끄는 중...'
  Stop-ScheduledTask -TaskName $task
  # 작업을 멈춰도 남는 서버 프로세스(8787을 잡고 있는 것)는 직접 끈다
  for ($i = 0; $i -lt 10 -and (Listening); $i++) { Start-Sleep -Milliseconds 500 }
  if (Listening) {
    Get-NetTCPConnection -LocalPort $port -State Listen |
      ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
  }
  if (Listening) { throw "8787 포트를 잡은 프로세스를 끄지 못했어요. 관리자 권한으로 다시 실행해 보세요." }
} else {
  Write-Host '서버가 꺼져 있어요 → 바로 켜요.'
}

Start-ScheduledTask -TaskName $task
for ($i = 0; $i -lt 30 -and -not (Listening); $i++) { Start-Sleep -Milliseconds 500 }
if (Listening) {
  Write-Host '서버를 켰어요 (127.0.0.1:8787).' -ForegroundColor Green
} else {
  throw '서버가 15초 안에 켜지지 않았어요. apps\server\.env 와 빌드(pnpm --filter @trippocket/server build)를 확인하세요.'
}
