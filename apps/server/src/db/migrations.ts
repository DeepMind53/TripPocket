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
];
