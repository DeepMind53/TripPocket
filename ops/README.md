# 홈 PC 서버 운영 (16단계)

구성: 휴대폰·PC 브라우저 → `https://<앱>.pages.dev` (Cloudflare Pages) → `/api`·`/auth`만 Pages 프록시가
비밀 헤더를 붙여 → Tailscale Funnel `https://<PC>.<tailnet>.ts.net` → 이 PC `127.0.0.1:8787` (ADR-0006).
PC가 꺼져 있어도 앱은 기기 안에서 그대로 동작하고, 다시 켜지면 동기화된다.

## 1. 설치 (한 번, 관리자 PowerShell)

1. `apps\server\.env.example` → `apps\server\.env` 복사 후 채우기
   - `WEB_ORIGIN`, `PROXY_SECRET`(32자 이상 무작위), 소셜 로그인 값(docs/deploy.md 5절)
   - `DATA_DIR=D:\TravelPlannerData` (저장소 폴더 밖 권장)
   - `BACKUP_KEY` — 백업 암호 문장(16자 이상). **잃어버리면 백업을 풀 수 없다 → 종이·비밀번호 관리자에 따로 보관**
   - `BACKUP_DIRS=E:\TripPocketBackup;C:\Users\<나>\OneDrive\TripPocket` (외장 디스크 + 클라우드, `;`로 구분)
2. `powershell -ExecutionPolicy Bypass -File D:\Travel_Planner\ops\install.ps1`
   - 서버 자동 시작(부팅 시, 멈추면 1분 뒤 재시작) + 매일 03:00 백업이 작업 스케줄러에 등록된다 (S4U: 비밀번호를 묻거나 저장하지 않고, 로그인하지 않아도 실행)

### 수동 시작·재시작

- 바탕화면 **"TripPocket 서버 재시작.bat"** (= `ops
estart-server.ps1`): 돌고 있으면 끄고 다시 켜고, 꺼져 있으면 바로 켠다
- PC를 다시 켜면 작업 스케줄러가 자동으로 켠다 (로그인 안 해도). Tailscale도 서비스로 자동 시작, Funnel은 `--bg`라 유지

## 2. 외부 주소 (Tailscale Funnel, 무료)

1. https://tailscale.com/download → 설치 → 로그인 (Google 계정 등)
2. https://login.tailscale.com/admin → Access controls에 Funnel 허용 (관리 화면 안내대로 "Enable Funnel")
3. `powershell -ExecutionPolicy Bypass -File D:\Travel_Planner\ops\funnel.ps1` → 나온 `https://...ts.net` 주소를
   Cloudflare Pages 환경 변수 `TP_SERVER_URL`에 (docs/deploy.md 2-1절)
4. 확인: 휴대폰에서 앱 → 마이 → 로그인

## 3. 백업 · 복구

- 자동: 매일 03:00 `BACKUP_DIRS` 각 폴더에 `trippocket-YYYY-MM-DD-HH-MM-SS.tpbk` (AES-256-GCM 암호화)
  - 보관: 최근 7일 하루 1개, 그 전 4주 주 1개, 그 전 6개월 달 1개 (나머지 자동 삭제)
  - 한 폴더가 실패해도(외장 디스크 빠짐) 다른 폴더에는 저장
- 수동: `cd apps\server; pnpm backup`
- **복구 리허설 (분기 1회, docs/09 §7.4)**:
  ```
  cd apps\server
  pnpm restore E:\TripPocketBackup\trippocket-....tpbk D:\RestoreTest\trippocket.sqlite
  ```
  → "복구 확인 완료: 사용자 n명, 기록 n개"가 나오면 성공 (기존 DB는 건드리지 않음)
- **실제 복구**: 작업 스케줄러에서 TripPocket Server 중지 → 위 명령으로 새 파일 만들기 →
  `DATA_DIR\trippocket.sqlite`(와 `-wal`, `-shm`)를 옮겨 두고 새 파일로 교체 → 서버 시작
- 기기 안 데이터는 각 휴대폰의 백업 파일(마이 → 백업·복원)로도 따로 지킬 수 있다

## 4. 상태 확인

- 이 PC: http://127.0.0.1:8787/healthz → `{"ok":true}`
- 밖에서 감시(선택, 무료): UptimeRobot → `https://<PC>.<tailnet>.ts.net/healthz` 5분마다, 멈추면 메일 알림
- 기록: 작업 스케줄러 → TripPocket Server/Backup → 기록 탭

## 5. 보안 점검표 (docs/09 §7 — 외부 공개 전 확인)

- [ ] 공유기 포트포워딩 없음, Windows 방화벽 인바운드 규칙 추가 안 함 (서버는 127.0.0.1만)
- [ ] 서버 실행 계정은 관리자가 아닌 전용 계정 (install.ps1 `-User`)
- [x] `DATA_DIR`·백업 폴더·`apps\server\.env` 권한: 서버 실행 계정 + SYSTEM + 관리자만 (2026-10-24 적용). PowerShell:
  ```
  $me = "$env:COMPUTERNAME\$env:USERNAME"
  icacls 'D:\Travel_Planner\apps\server\.env' /inheritance:r /grant:r "${me}:F" "SYSTEM:F" "Administrators:F"
  icacls 'D:\TravelPlannerData' /inheritance:r /grant:r "${me}:(OI)(CI)F" "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F"
  icacls 'D:\TravelPlannerData\*' /reset /T   # 안의 파일은 폴더 권한을 물려받게
  ```
  - ⚠️ 폴더 명령에 `/T`를 붙이면 파일 권한이 비어 서버가 DB를 못 연다 (2026-10-24 겪은 일) → 폴더만 바꾸고 파일은 `/reset`
  - 관리자 권한으로 만들어진 오래된 백업 파일 1개는 관리자 권한이 있어야 바뀐다 (백업은 AES 암호화라 급하지 않음)
- [ ] 설정 → 개인 정보 및 보안 → 장치 암호화 켜짐 (Windows 11 Home 지원 여부 확인, 안 되면 백업 암호화로 보완 — 이미 적용)
- [ ] Windows 업데이트 자동, 절전 안 함(설정 → 전원 → 화면·절전 "안 함"), BIOS "전원 복구 시 켜짐"(선택)
- [ ] `PROXY_SECRET`·`BACKUP_KEY`·OAuth 시크릿은 `.env`와 Pages 환경 변수에만 (저장소·채팅에 붙여넣지 않기)
- [ ] 직접 호출 차단 확인: 브라우저로 `https://<PC>.ts.net/api/me` → 404
- [ ] 복구 리허설 1회 성공
- [ ] 다른 사람이 쓴다면 개인정보처리방침 게시 (23단계)

## 6. 업데이트

```
cd D:\Travel_Planner
git pull
pnpm install --frozen-lockfile
pnpm --filter @trippocket/server build
```

→ 작업 스케줄러에서 TripPocket Server "끝내기" → **3초 기다린 뒤** "실행" (바로 켜면 포트가 아직 안 풀려 실패할 수 있음, DB 마이그레이션은 시작할 때 자동)

- 작업은 S4U(비밀번호 저장 없이, 로그인 안 해도 실행)로 등록된다. 이전 실행이 멈춰 "실행 중"인데 응답이 없으면:
  가장 간단한 방법은 **PC 재시작**. 재시작 없이: `Stop-ScheduledTask 'TripPocket Server'` → 작업 관리자 "세부 정보"에서 사용자 이름이 내 계정인 `node.exe` 중 응답 없는 것(세션 0) 끝내기 → `Start-ScheduledTask 'TripPocket Server'`

## 5. 리소스 (2026-10-25 점검)

- 서버(node) 평소: CPU 0%, 메모리 약 78MB(전용 약 40MB). DB 약 250KB
- 줄인 것: 로그 단계 기본 `warn`(요청마다 기록 안 함, `.env`의 `LOG_LEVEL=info`로 다시 켬),
  6시간마다 DB 정리(만료 세션·로그인 state·AI 저장본, 13개월 넘은 사용량) + WAL 비우기, 항공편 메모리 저장본 상한
- 서버가 아닌 것: 개발용 화면 서버(vite, `pnpm dev`)는 400MB 가까이 쓴다 — 개발할 때만 켜 두기
