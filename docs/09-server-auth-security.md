# 09. 홈 서버 · 로그인 · 동기화 · 보안

- 문서 상태: 초안 v0.1 (2026-10-22) — ⚠️ 표시는 `08-open-decisions.md`에서 확정 필요
- 관련 ADR: [ADR-0003](adr/0003-home-pc-sync-server.md)

## 1. 목표
- 사용자가 **로그인**하면 여행 데이터를 **이 컴퓨터(홈 PC)** 에 저장하고, 다른 기기에서 불러올 수 있다.
- 그래도 **오프라인 우선**은 유지한다: 휴대폰 IndexedDB가 1차 저장소, 홈 서버는 **동기화·백업 저장소**.
  → PC가 꺼져 있거나 해외에서 인터넷이 없어도 앱은 그대로 동작하고, 연결되면 자동 동기화.
- 동행자와 **여행 공동 편집**(초대 링크, 권한)이 가능해진다.

## 2. 전체 구성
```
 [휴대폰 브라우저 / PWA]                         [홈 PC (Windows 11)]
 ┌──────────────────────┐   HTTPS   ┌──────────────┐  아웃바운드 터널  ┌───────────────────────────┐
 │ React 앱             │──────────▶│ Cloudflare   │◀═════════════════│ cloudflared (Windows 서비스)│
 │ IndexedDB (1차 저장) │◀──────────│ (TLS, WAF,   │                   │          │ localhost     │
 │ Sync 엔진            │           │  Rate limit) │                   │          ▼               │
 └──────────────────────┘           └──────────────┘                   │ API 서버 (Node.js, :8787) │
        │ 정적 파일                                                    │  ├─ 인증/세션             │
        ▼                                                              │  ├─ 동기화 API            │
 ┌──────────────────────┐                                              │  ├─ 지도/장소 프록시      │
 │ Cloudflare Pages     │  ← PC가 꺼져도 앱은 열린다                     │  └─ 첨부파일             │
 │ (웹앱 정적 호스팅)     │                                              │ SQLite DB + files/        │
 └──────────────────────┘                                              │ 야간 암호화 백업 → 외장/클라우드│
                                                                       └───────────────────────────┘
```
### 왜 Cloudflare Tunnel인가 ⚠️
| 방식 | 판단 |
|---|---|
| 공유기 포트포워딩 + DDNS | ❌ PC가 인터넷에 직접 노출, 공인 IP 변경, 인증서 직접 관리, 공격 표면 큼 |
| **Cloudflare Tunnel** | ✅ **인바운드 포트 0개** (PC가 밖으로 연결), 자동 HTTPS, DDoS/WAF/Rate limit, 무료. 단 도메인 필요(연 1~2만 원) |
| Tailscale Funnel | △ 간편하나 커스텀 도메인·WAF 제약 |
| Tailscale(사설망) | △ 본인 기기만 접속 가능 → "누구나"에는 부적합 |

- 도메인 예: `trip.example.com`(웹앱, Pages) / `api.trip.example.com`(홈 서버, Tunnel)

## 3. 서버 기술 스택 (제안)
| 영역 | 제안 | 이유 |
|---|---|---|
| 런타임 | Node.js 24 LTS (이미 설치됨) | 프론트와 언어 통일 |
| 프레임워크 | **Fastify** ⚠️ (대안 Hono) | 성능, 스키마 검증, 플러그인 생태계(helmet, rate-limit, cookie) |
| DB | **SQLite** (WAL 모드) + **Drizzle ORM** | 1대 PC·소규모 사용자에 최적, 파일 하나로 백업 쉬움. 규모 커지면 PostgreSQL 이전 가능 |
| 검증 | **Zod** — `packages/shared`의 스키마를 웹·서버 공용 | 단일 정의 |
| 서비스 등록 | **WinSW** 또는 NSSM ⚠️ | 부팅 시 자동 시작, 크래시 시 재시작 |
| 로그 | pino (JSON) + 일별 로테이션 | 개인정보 마스킹 |
| 저장소 구조 | **pnpm 모노레포**: `apps/web`, `apps/server`, `packages/shared` | 타입·스키마 공유 |

## 4. 로그인 (인증)
### 4.1 방식 — 비밀번호를 저장하지 않는다
| 방식 | 판단 |
|---|---|
| **소셜 로그인 (네이버 / 카카오 / 구글)** | ✅ 제안. 비밀번호 유출 위험 0, 한국 사용자 친숙. OAuth 2.0 Authorization Code + **PKCE** + `state` |
| 패스키 (WebAuthn) | ✅ P1 추가 제안. 피싱 저항, 생체인증 |
| 이메일+비밀번호 | △ 필요하면 Argon2id 해시 + 이메일 인증 + 재설정 플로우까지 구현해야 함 → 비권장 |

- 로그인 흐름: `웹앱 → /auth/{provider}/start → 제공자 로그인 → /auth/{provider}/callback (서버에서 code 교환, 시크릿은 서버에만) → 세션 생성 → 웹앱으로 리다이렉트`
- 저장하는 개인정보 최소화: `provider`, `providerUserId`, `닉네임`, (선택) 이메일. 프로필 사진·전화번호 수집 안 함.

### 4.2 세션
- 서버 세션 방식 (JWT 미사용 — 즉시 폐기·강제 로그아웃이 쉬움).
- 세션 ID: 256bit 랜덤, DB에는 **SHA-256 해시만 저장** (DB 유출 시 세션 탈취 방지).
- 쿠키: `__Host-sid; HttpOnly; Secure; SameSite=Lax; Path=/` — 웹앱·API를 같은 사이트(서브도메인)로 두어 쿠키 사용 가능하게.
- 만료: 30일 슬라이딩, 절대 만료 90일. 로그인 시 세션 ID 재발급(세션 고정 방지).
- 설정 화면 "로그인된 기기" 목록 + 개별/전체 로그아웃.

### 4.3 가입 정책 ⚠️ (중요 결정)
| 옵션 | 설명 |
|---|---|
| A. 초대제 (허용 목록) | 내가 승인한 사람만 서버 사용 — 홈 PC 부하·보안 위험 최소 **(제안)** |
| B. 누구나 가입 | 사용자 수 제한 + 1인당 저장 용량 제한 필요, 개인정보처리방침 필수 |
| 공통 | 로그인 안 해도 앱은 **로컬 전용 모드**로 전부 사용 가능 (기존 설계 유지) |

## 5. 권한 (인가)
- 모든 데이터는 `Trip` 단위로 접근 제어. `trip_members(tripId, userId, role)`
  - `owner`: 전체 권한, 멤버 관리, 삭제
  - `editor`: 일정/예약/준비물 편집
  - `viewer`: 읽기 전용
- **모든 쿼리는 서버에서 `userId`의 멤버십을 확인한 뒤 실행** — 클라이언트가 보낸 tripId를 그대로 신뢰하지 않음 (IDOR 방지). repository 레이어에 강제.
- 초대 링크: 랜덤 토큰(128bit+), 만료 7일, 사용 횟수 제한, 역할 지정, 언제든 폐기.

## 6. 동기화 설계
### 6.1 원칙
- 클라이언트 IndexedDB = 진실의 1차 원천 (UI는 항상 로컬에서 읽음).
- 서버 = 사용자/여행 단위 변경 로그를 가진 **동기화 허브**.
- 엔티티 단위 **LWW(Last-Write-Wins)** + 소프트 삭제(툼스톤). 필드 단위 병합은 P2.

### 6.2 메타 필드 (모든 동기화 엔티티)
| 필드 | 의미 |
|---|---|
| `id` | UUID v7 (클라이언트 생성 → 오프라인 생성 가능) |
| `updatedAt` | 클라이언트 수정 시각 |
| `rev` | **서버가 부여**하는 단조 증가 번호 (서버 전역 시퀀스) |
| `deletedAt` | 소프트 삭제 |
| `dirty` (로컬 전용) | 서버에 아직 안 보낸 변경 |

### 6.3 프로토콜
```
POST /api/sync/push   { changes: [{ table, record, baseRev }] }
  → 서버: 권한 확인 → baseRev == 현재 rev 면 적용 / 아니면 충돌
          충돌 시 **나중에 서버에 도착한 쪽 채택**(기기 시계 오차 영향 없음), 진 쪽은 conflicts 로그에 보관(복구 가능)
  ← { applied: [{id, rev}], conflicts: [...] }

GET  /api/sync/pull?since=<lastRev>&limit=500
  ← { changes: [...], nextRev, hasMore }
```
- 트리거: 앱 시작, 온라인 복귀(`online` 이벤트), 편집 후 디바운스 3초, 30초 주기(앱 포그라운드일 때).
- 첫 로그인 시: 로컬에 이미 있는 데이터를 계정으로 **업로드할지 묻기** (기기 공용 사용 고려).
- 로그아웃 시: 로컬 데이터 **유지/삭제 선택** (공용 기기 대비 기본값 질문).
- 실시간 반영(공동 편집 중 즉시 표시)은 P2: SSE/WebSocket.

### 6.4 첨부파일
- `POST /api/files` (multipart, 최대 10MB ⚠️), 서버에서 **매직 바이트로 형식 검증** (jpg/png/webp/heic/pdf만), 랜덤 파일명으로 `data/files/` 저장 (웹 루트 밖).
- 다운로드는 권한 확인 후 `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
- 사용자별 저장 용량 쿼터 (예: 500MB) ⚠️.

## 7. 보안 체크리스트
### 7.1 네트워크 / 호스트 (홈 PC)
- [ ] 공유기 포트포워딩 **없음**. Windows 방화벽 인바운드 규칙 추가 안 함. API는 `127.0.0.1`에만 바인딩.
- [ ] 서버는 **관리자 권한이 없는 전용 Windows 계정**으로 실행.
- [ ] 데이터 폴더(`D:\TravelPlannerData` 등) NTFS 권한: 서비스 계정 + 관리자만.
- [ ] 디스크 암호화: Windows 11 Home은 "장치 암호화" 지원 여부 확인, 미지원 시 백업 파일 암호화로 보완 ⚠️.
- [ ] Windows Update 자동, 절전 모드 해제, 업데이트 후 서비스 자동 재시작 확인.
- [ ] Cloudflare: WAF 기본 규칙, 국가 제한(선택), `/auth/*` Rate limiting, Bot Fight Mode.

### 7.2 애플리케이션 (OWASP Top 10 기준)
- [ ] 모든 입력 Zod 검증, 요청 본문 크기 제한(1MB, 파일 제외).
- [ ] SQL은 Drizzle 파라미터 바인딩만 (문자열 조합 금지).
- [ ] 인가: 모든 엔드포인트에 `requireUser` + 여행 멤버십 검사 미들웨어. **인가 누락 테스트**(다른 사용자 tripId 접근 시 404) 자동화.
- [ ] CSRF: `SameSite=Lax` + 상태 변경 요청은 `Origin` 헤더 검증 + 커스텀 헤더(`X-Requested-With`) 요구.
- [ ] CORS: 웹앱 origin 1개만 허용, `credentials: true`.
- [ ] 보안 헤더(@fastify/helmet): CSP, HSTS, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] Rate limit: 로그인 콜백 IP당 10회/분, API 사용자당 300회/분, 장소 검색 사용자당 일 100회 ⚠️.
- [ ] XSS: 리뷰 등 외부 텍스트는 텍스트로만 렌더 (`dangerouslySetInnerHTML` 금지).
- [ ] 에러 응답에 스택트레이스·SQL 노출 금지. 로그에 토큰/쿠키/이메일 마스킹.
- [ ] 의존성: `pnpm audit` CI, Renovate/Dependabot, lockfile 고정.

### 7.3 비밀값(Secrets)
- [ ] OAuth 클라이언트 시크릿, Google 서버 키, Naver 시크릿, Anthropic API 키, 카카오 REST 키, 세션 서명 키는 `apps/server/.env` (git 제외) — 파일 권한 서비스 계정 전용.
- [ ] 키 로테이션 절차 문서화. 유출 시 즉시 폐기 가능하도록 키 목록 관리.
- [ ] 브라우저에 노출되는 지도 키는 **도메인(리퍼러) 제한 + API 제한 + 일일 쿼터** 필수 (`10-maps-places.md`).

### 7.4 백업 / 복구
- [ ] 매일 03:00 SQLite 온라인 백업(`VACUUM INTO`) + files 폴더 → **암호화 압축**(age 또는 7-Zip AES-256) → 외장 디스크 + 클라우드(OneDrive 등) 1부.
- [ ] 보관: 일 7개, 주 4개, 월 6개.
- [ ] **분기 1회 복구 리허설** (백업으로 새 폴더에 서버 띄워보기).
- [ ] 클라이언트에도 기존 JSON 백업 기능 유지 → 서버 장애에도 사용자가 자기 데이터 보유.

### 7.5 가용성 / 모니터링
- [ ] `/healthz` 엔드포인트 + 외부 모니터(UptimeRobot 무료 등) → 다운 시 알림.
- [ ] PC가 꺼져도 앱은 로컬 모드로 동작 (사용자 화면: "동기화 대기 중" 표시만).
- [ ] 정전 대비 UPS (선택), BIOS "전원 복구 시 자동 켜짐" 설정.

### 7.6 개인정보 / 법적
- [ ] 다른 사람이 사용한다면 **개인정보처리방침** 게시 (수집 항목, 목적, 보관 기간, 파기, 문의처).
- [ ] 회원 탈퇴 시 서버 데이터 즉시 삭제(백업은 보관 주기 후 소멸) + 내 데이터 내보내기.
- [ ] 위치 정보는 **서버로 전송·저장하지 않음** (길찾기·거리 계산은 기기에서만) → 위치정보법 부담 회피.

## 8. API 목록 (초안)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/auth/:provider/start` | OAuth 시작 (naver, kakao, google) |
| GET | `/auth/:provider/callback` | OAuth 콜백 → 세션 발급 |
| POST | `/auth/logout` | 현재 세션 종료 |
| GET | `/api/me` | 내 정보 |
| GET/DELETE | `/api/me/sessions[/:id]` | 로그인 기기 관리 |
| DELETE | `/api/me` | 회원 탈퇴 |
| POST | `/api/sync/push` | 변경 업로드 |
| GET | `/api/sync/pull` | 변경 다운로드 |
| POST | `/api/trips/:id/invites` | 초대 링크 생성 |
| POST | `/api/invites/:token/accept` | 초대 수락 |
| GET/PATCH/DELETE | `/api/trips/:id/members[/:userId]` | 멤버 관리 |
| POST/GET | `/api/files[/:id]` | 첨부 업로드/다운로드 |
| GET | `/api/places/search` | 장소 검색 프록시 (평점 필터) |
| GET | `/api/places/:placeId` | 장소 상세 + 리뷰 프록시 |
| GET | `/api/fx/latest` | 환율 (공개, 캐시, IP rate limit) |
| POST | `/api/v1/ai/recommend` | AI 추천 (로그인, 하루 한도) — `14` 문서 |
| GET | `/api/v1/ai/recommend/usage` | AI 추천 남은 횟수 |
| POST/DELETE | `/api/trips/:id/share` | 보기 전용 공유 링크 생성/끄기 |
| GET | `/api/public/shares/:shareId` | 공유 일정 조회 (로그인 불필요, 민감정보 제외 옵션 적용) |
| GET | `/healthz` | 상태 확인 |

## 9. 서버 DB 스키마 (요약)
```
users(id, nickname, email?, created_at, status)
oauth_accounts(provider, provider_user_id, user_id)          -- UNIQUE(provider, provider_user_id)
sessions(id_hash, user_id, created_at, last_seen_at, expires_at, user_agent, ip_prefix)
trip_members(trip_id, user_id, role, created_at)
invites(token_hash, trip_id, role, expires_at, max_uses, used_count, created_by)
records(table_name, id, trip_id, owner_user_id, data_json, updated_at, deleted_at, rev)  -- 동기화 엔티티 저장
conflicts(id, table_name, record_id, losing_data_json, created_at)
files(id, trip_id, uploader_id, mime, size, sha256, path, created_at, deleted_at)
places_usage(user_id, date, count)                            -- 장소 API 사용량 제한
ai_usage(user_id, date, count) / ai_cache(key, result_json, expires_at)   -- AI 추천
fx_rates(date, currency, deal_bas_r, ttb, tts, fetched_at)                 -- 환율 (공개 데이터)
shares(id, trip_id, created_by, include_sensitive, revoked_at, created_at)  -- 보기 전용 링크 (id = 128bit 랜덤)
audit_log(id, user_id, action, target, created_at)            -- 로그인, 멤버 변경, 탈퇴 등
```
- `records`에 엔티티를 JSON으로 저장하는 이유: 클라이언트 스키마 변경 시 서버 마이그레이션 부담 최소화. 검증은 `packages/shared` Zod 스키마로.
