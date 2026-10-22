# 트립포켓 홈 서버 설치 (16단계) — 관리자 PowerShell에서 한 번 실행
#   powershell -ExecutionPolicy Bypass -File D:\Travel_Planner\ops\install.ps1
#
# 하는 일 (Windows 기본 "작업 스케줄러" 사용 — 따로 받을 프로그램 없음, docs/08 G4):
#   1) 서버 빌드
#   2) "TripPocket Server": PC가 켜지면 자동 시작, 멈추면 1분 뒤 다시 시작 (로그인하지 않아도 실행)
#   3) "TripPocket Backup": 매일 03:00 암호화 백업
# 서버는 127.0.0.1에만 열린다 — 방화벽·공유기 설정을 바꾸지 않는다 (docs/09 §7.1)

param(
  [string]$Repo = (Resolve-Path "$PSScriptRoot\..").Path,
  # 서버를 실행할 Windows 계정 (관리자가 아닌 전용 계정 권장, docs/09 §7.1)
  [string]$User = "$env:USERDOMAIN\$env:USERNAME"
)
$ErrorActionPreference = 'Stop'

$server = Join-Path $Repo 'apps\server'
if (-not (Test-Path (Join-Path $server '.env'))) {
  throw "apps\server\.env 가 없어요. .env.example 을 복사해 값을 채운 뒤 다시 실행하세요."
}
$node = (Get-Command node).Source

Write-Host '1) 서버 빌드'
Push-Location $Repo
pnpm install --frozen-lockfile
pnpm --filter @trippocket/server build
Pop-Location

$cred = Get-Credential -UserName $User -Message '서버를 실행할 Windows 계정 비밀번호 (작업 스케줄러가 로그인 없이 실행하려면 필요)'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Write-Host '2) 서버 자동 시작 등록'
$serverAction = New-ScheduledTaskAction -Execute $node `
  -Argument '--env-file=.env dist\index.js' -WorkingDirectory $server
Register-ScheduledTask -TaskName 'TripPocket Server' -Action $serverAction `
  -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings `
  -User $cred.UserName -Password $cred.GetNetworkCredential().Password -Force | Out-Null

Write-Host '3) 매일 03:00 백업 등록'
$backupAction = New-ScheduledTaskAction -Execute $node `
  -Argument '--env-file=.env dist\backup.js' -WorkingDirectory $server
Register-ScheduledTask -TaskName 'TripPocket Backup' -Action $backupAction `
  -Trigger (New-ScheduledTaskTrigger -Daily -At 3am) -Settings $settings `
  -User $cred.UserName -Password $cred.GetNetworkCredential().Password -Force | Out-Null

Start-ScheduledTask -TaskName 'TripPocket Server'
Start-Sleep -Seconds 3
try {
  $health = Invoke-RestMethod 'http://127.0.0.1:8787/healthz'
  Write-Host "서버 동작 확인: $($health | ConvertTo-Json -Compress)"
} catch {
  Write-Warning '서버 응답이 없어요. 작업 스케줄러 → TripPocket Server → 기록을 확인하세요.'
}
Write-Host '완료. 다음: ops\funnel.ps1 로 외부 주소 열기 (ops\README.md 2절)'
