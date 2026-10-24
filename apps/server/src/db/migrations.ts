/**
 * 서버 DB 마이그레이션 (docs/09 §9). 이미 배포된 항목은 고치지 말고 뒤에 새 항목을 더한다.
 * 동기화 엔티티는 records에 JSON으로 저장 — 앱 스키마가 바뀌어도 서버 마이그레이션이 거의 필요 없다.
 */
export const MIGRATIONS: readonly string[] = [
  // 1: 계정·세션·여행 멤버·동기화 기록
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );
  CREATE TABLE oauth_accounts (
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (provider, provider_user_id)
  );
  CREATE TABLE sessions (
    id_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    absolute_expires_at TEXT NOT NULL,
    user_agent TEXT
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE trip_members (
    trip_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (trip_id, user_id)
  );
  CREATE INDEX trip_members_user ON trip_members(user_id);
  CREATE TABLE records (
    table_name TEXT NOT NULL,
    id TEXT NOT NULL,
    trip_id TEXT,
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    rev INTEGER NOT NULL,
    PRIMARY KEY (table_name, id)
  );
  CREATE INDEX records_rev ON records(rev);
  CREATE INDEX records_trip ON records(trip_id);
  CREATE TABLE conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    losing_data_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    target TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
  INSERT INTO counters (name, value) VALUES ('rev', 0);
  `,
  // 2: 로그인 진행 중 상태 (10분, 한 번만 사용)
  `
  CREATE TABLE oauth_states (
    state_hash TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    code_verifier TEXT,
    return_to TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // 3: 환율 (공개 데이터, 수출입은행 매매기준율 — 1단위 원화)
  `
  CREATE TABLE fx_rates (
    date TEXT NOT NULL,
    currency TEXT NOT NULL,
    rate REAL NOT NULL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (date, currency)
  );
  `,
  // 4: AI 추천 사용량·캐시 (docs/14 §9) — 기준점 이름만, 좌표 없음
  `
  CREATE TABLE ai_usage (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (user_id, date)
  );
  CREATE TABLE ai_cache (
    key TEXT PRIMARY KEY,
    result_json TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  `,
  // 5: 보기 전용 공유 링크·초대 (S-24/25/40/41)
  `
  CREATE TABLE shares (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    include_sensitive INTEGER NOT NULL DEFAULT 0,
    revoked_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX shares_trip ON shares(trip_id);
  CREATE TABLE invites (
    token_hash TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    expires_at TEXT NOT NULL,
    max_uses INTEGER NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );
  `,
  // 6: 장소 검색 하루 사용량 (사람별 + 서버 전체 '*') — Google 무료 한도 지키기
  `
  CREATE TABLE places_usage (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    kind TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (user_id, date, kind)
  );
  `,
  // 7: 관리자(첫 계정) + 가입 요청 — 관리자가 앱에서 승인·거절, 사용 중지는 users.status='disabled'
  `
  ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
  UPDATE users SET is_admin = 1 WHERE id = (SELECT id FROM users ORDER BY created_at, id LIMIT 1);
  CREATE TABLE join_requests (
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rejected')),
    requested_at TEXT NOT NULL,
    PRIMARY KEY (provider, provider_user_id)
  );
  `,
  // 8: 외부 API 사용량(날짜별)·관리자 제어(수동 중지·자동 상한) — services/apiUsage.ts
  `
  CREATE TABLE api_usage (
    api TEXT NOT NULL,
    date TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (api, date)
  );
  CREATE TABLE api_controls (
    api TEXT PRIMARY KEY,
    paused INTEGER NOT NULL DEFAULT 0,
    auto_limit INTEGER
  );
  INSERT INTO api_usage (api, date, count)
    SELECT 'google_places_search', date, count FROM places_usage WHERE user_id = '*' AND kind = 'all-google';
  INSERT INTO api_usage (api, date, count)
    SELECT 'google_places_details', date, count FROM places_usage WHERE user_id = '*' AND kind = 'all-details';
  `,
  // 9: 하루 자동 중지 상한 (카카오·AI 등 하루 무료량이 있는 API) — services/apiUsage.ts
  `
  ALTER TABLE api_controls ADD COLUMN auto_daily_limit INTEGER;
  `,
  // 10: 카카오 로컬을 API별(키워드·카테고리)로 나누고 월 합산 묶음(kakao_map) — 지금까지 기록은 키워드로, 합산에도 넣는다
  `
  INSERT INTO api_usage (api, date, count) SELECT 'kakao_map', date, count FROM api_usage WHERE api = 'kakao_local';
  UPDATE api_usage SET api = 'kakao_keyword' WHERE api = 'kakao_local';
  UPDATE api_controls SET api = 'kakao_keyword' WHERE api = 'kakao_local';
  `,
  // 11: 닉네임을 직접 정했는지 (처음 로그인하면 앱이 닉네임 정하기를 띄운다) — routes/me.ts
  `
  ALTER TABLE users ADD COLUMN nickname_set INTEGER NOT NULL DEFAULT 0;
  `,
  // 12: 초대 링크로 들어오면 바로 멤버가 아니라 '참여 요청' → 여행 소유자가 허용해야 멤버 (routes/share.ts)
  `
  CREATE TABLE trip_join_requests (
    trip_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    requested_at TEXT NOT NULL,
    PRIMARY KEY (trip_id, user_id)
  );
  `,
];
