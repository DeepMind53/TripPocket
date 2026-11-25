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
  // 13: 사용자별 설정 (기기별 설정 — 테마·글자 크기·진동 — 은 빼고). 나중에 바꾼 쪽이 이긴다 — routes/me.ts
  `
  CREATE TABLE user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  // 14: 후기·포인트 (docs/17). User#N = 가입 순 고정 번호(새 사용자는 트리거로), 닉네임 가리기.
  // 탈퇴해도 후기는 남고 작성자는 User#N (user_id = NULL, author_no 보관). 포인트 기록은 함께 삭제
  `
  ALTER TABLE users ADD COLUMN public_no INTEGER;
  ALTER TABLE users ADD COLUMN hide_nickname INTEGER NOT NULL DEFAULT 0;
  UPDATE users SET public_no = (
    SELECT COUNT(*) FROM users u2
    WHERE u2.created_at < users.created_at OR (u2.created_at = users.created_at AND u2.id <= users.id)
  );
  CREATE UNIQUE INDEX users_public_no ON users(public_no);
  CREATE TRIGGER users_public_no_assign AFTER INSERT ON users WHEN NEW.public_no IS NULL
  BEGIN
    UPDATE users SET public_no = (SELECT COALESCE(MAX(public_no), 0) + 1 FROM users) WHERE id = NEW.id;
  END;
  CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    author_no INTEGER NOT NULL,
    trip_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    place_key TEXT,
    place_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    ratings_json TEXT NOT NULL,
    note TEXT,
    visited_on TEXT,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX reviews_user_item ON reviews(user_id, item_id);
  CREATE INDEX reviews_place ON reviews(place_key, hidden, created_at);
  CREATE INDEX reviews_item ON reviews(trip_id, item_id);
  CREATE TABLE point_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    review_id TEXT,
    place_key TEXT,
    place_name TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX point_ledger_user ON point_ledger(user_id, created_at);
  `,
  // 15: 웹 푸시 알림 (docs/20 G1) — 기기 구독 + 같은 알림 한 번만
  `
  CREATE TABLE push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    prefs_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);
  CREATE TABLE push_sent (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  `,
  // 16: 예약 문서(이티켓·바우처) — 파일은 DATA_DIR/attachments/<id>, 끝난 여행은 지움 (docs/20 G2)
  `
  CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL,
    booking_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX attachments_trip ON attachments(trip_id);
  `,
  // 17: 개선 제안 (마이 → 개선 제안 → 관리자) — 사진은 DATA_DIR/suggestions/<id>. 탈퇴해도 제안은 남음
  `
  CREATE TABLE suggestions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    image_mime TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    reply TEXT,
    created_at TEXT NOT NULL,
    replied_at TEXT
  );
  CREATE INDEX suggestions_user ON suggestions(user_id, created_at);
  `,
  // 18: 사용 통계 (관리자만, ADR-0009) — 날짜·종류·이름별 횟수만, 누가 했는지는 남기지 않음. 3년 보관.
  // last_active_date = 오늘 처음 쓴 사람만 하루 사용자 수에 더하려고 (날짜 하나만 덮어씀)
  `
  CREATE TABLE usage_stats (
    date TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, kind, name)
  );
  ALTER TABLE users ADD COLUMN last_active_date TEXT;
  `,
  // 19: 사용 통계 보강 — 쓴 날 수(재방문 분포용, 숫자 하나만 늘림). 누가 언제 썼는지는 남기지 않음
  `
  ALTER TABLE users ADD COLUMN active_days INTEGER NOT NULL DEFAULT 0;
  `,
  // 20: 가입 요청에 관리자에게 전할 말 (2026-11-03) — 승인·거절하면 지운다. 적기용 1회 토큰(해시·30분)
  `
  ALTER TABLE join_requests ADD COLUMN note TEXT;
  ALTER TABLE join_requests ADD COLUMN note_token_hash TEXT;
  ALTER TABLE join_requests ADD COLUMN note_token_exp TEXT;
  `,
  // 21: 거절 횟수 (2026-11-03) — 요청 줄을 지워도 남는다. 2번 거절되면 영구 차단
  `
  CREATE TABLE join_rejections (
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (provider, provider_user_id)
  );
  `,
  // 22: 네이버 로그인 뺌 (2026-11-03 사용자 결정) — 네이버로 들어온 가입 요청은 더 승인할 수 없으니 지운다
  `
  DELETE FROM join_requests WHERE provider = 'naver';
  `,
  // 23: 숙소 가격 기록 (docs/28 §7, ADR-0010) — 사용자가 본 가격, 30일 뒤 지움, 로그인한 모두가 봄(작성자 비공개).
  // 여행·좌표·자유 글은 없다. 탈퇴하면 그 사람 기록도 지운다 (ON DELETE CASCADE)
  `
  CREATE TABLE lodging_price_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hotel_key TEXT NOT NULL,
    hotel_name TEXT NOT NULL,
    city TEXT,
    check_in TEXT NOT NULL,
    nights INTEGER NOT NULL,
    adults INTEGER NOT NULL,
    rooms INTEGER NOT NULL,
    site TEXT NOT NULL,
    route TEXT,
    price INTEGER NOT NULL,
    price_type TEXT NOT NULL,
    currency TEXT NOT NULL,
    tax TEXT NOT NULL,
    tags TEXT NOT NULL,
    seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX lodging_reports_hotel ON lodging_price_reports(hotel_key, expires_at);
  CREATE INDEX lodging_reports_user ON lodging_price_reports(user_id, seen_at);
  CREATE INDEX lodging_reports_expires ON lodging_price_reports(expires_at);
  `,
  // 24: 나갈 시각 알림 (ADR-0013, docs/27 F1) — 앱이 계산한 "HH:mm"만. 좌표·이동 시간 없음.
  // 사람·일정마다 한 줄, 날짜가 지나면 지운다. 탈퇴하면 함께 지움 (ON DELETE CASCADE)
  `
  CREATE TABLE push_leave (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    trip_id TEXT NOT NULL,
    date TEXT NOT NULL,
    leave_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, item_id)
  );
  CREATE INDEX push_leave_date ON push_leave(date);
  `,
  // 25: 내 기록 분리 (2026-11-25 사용자 요청 "개인별로 달라야 하는 것은 계정별로") — 일정의 방문·다녀옴 표시와
  // 여행의 하루 한 줄(dayNotes)을 **여행 주인의** 개인 행(itemMarks·dayNotes)으로 옮기고, 함께 보는 행에서는 지운다.
  // 지운 행은 rev를 올려 일행 기기에서도 사라지게 한다 (사용자 결정: 예전 표시는 여행 주인 것으로)
  `
  CREATE TEMP TABLE _mk AS
    SELECT r.id AS item_id, r.trip_id AS trip_id,
      COALESCE((SELECT m.user_id FROM trip_members m WHERE m.trip_id = r.trip_id AND m.role = 'owner'), r.owner_user_id) AS owner,
      json_extract(r.data_json, '$.visit') AS visit,
      CASE WHEN json_extract(r.data_json, '$.done') = 1 THEN 1 ELSE 0 END AS done
    FROM records r
    WHERE r.table_name = 'items' AND r.deleted_at IS NULL AND r.trip_id IS NOT NULL
      AND (json_extract(r.data_json, '$.visit') IS NOT NULL OR json_extract(r.data_json, '$.done') = 1);
  CREATE TEMP TABLE _dn AS
    SELECT r.id AS trip_id,
      COALESCE((SELECT m.user_id FROM trip_members m WHERE m.trip_id = r.id AND m.role = 'owner'), r.owner_user_id) AS owner,
      json_extract(j.value, '$.date') AS date, json_extract(j.value, '$.text') AS text
    FROM records r, json_each(r.data_json, '$.dayNotes') j
    WHERE r.table_name = 'trips' AND r.deleted_at IS NULL;
  CREATE TEMP TABLE _now AS SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS t, (SELECT value FROM counters WHERE name = 'rev') AS base;
  CREATE TEMP TABLE _ids AS
    SELECT 'mk' AS kind, rowid AS rid,
      lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
      substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) AS id
    FROM _mk
    UNION ALL
    SELECT 'dn', rowid,
      lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
      substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
    FROM _dn;
  INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, deleted_at, rev)
    SELECT 'itemMarks', i.id, k.trip_id, k.owner,
      json_patch('{}', json_object('id', i.id, 'createdAt', n.t, 'updatedAt', n.t, 'tripId', k.trip_id, 'itemId', k.item_id,
        'visit', k.visit, 'done', CASE WHEN k.done = 1 THEN json('true') ELSE NULL END)),
      n.t, NULL, n.base + row_number() OVER (ORDER BY k.rowid)
    FROM _mk k JOIN _ids i ON i.kind = 'mk' AND i.rid = k.rowid, _now n;
  INSERT INTO records (table_name, id, trip_id, owner_user_id, data_json, updated_at, deleted_at, rev)
    SELECT 'dayNotes', i.id, d.trip_id, d.owner,
      json_object('id', i.id, 'createdAt', n.t, 'updatedAt', n.t, 'tripId', d.trip_id, 'date', d.date, 'text', d.text),
      n.t, NULL, n.base + (SELECT COUNT(*) FROM _mk) + row_number() OVER (ORDER BY d.rowid)
    FROM _dn d JOIN _ids i ON i.kind = 'dn' AND i.rid = d.rowid, _now n
    WHERE d.date IS NOT NULL AND d.text IS NOT NULL;
  CREATE TEMP TABLE _strip AS
    SELECT table_name, id FROM records
    WHERE (table_name = 'items' AND (json_extract(data_json, '$.visit') IS NOT NULL OR json_extract(data_json, '$.done') IS NOT NULL))
       OR (table_name = 'trips' AND json_extract(data_json, '$.dayNotes') IS NOT NULL);
  UPDATE records SET
    data_json = json_remove(data_json, '$.visit', '$.done', '$.dayNotes'),
    rev = (SELECT MAX(rev) FROM records) + (SELECT COUNT(*) FROM _strip s2 WHERE s2.rowid <= (SELECT s.rowid FROM _strip s WHERE s.table_name = records.table_name AND s.id = records.id))
  WHERE (table_name, id) IN (SELECT table_name, id FROM _strip);
  UPDATE counters SET value = (SELECT MAX(rev) FROM records) WHERE name = 'rev' AND (SELECT MAX(rev) FROM records) > value;
  DROP TABLE _mk; DROP TABLE _dn; DROP TABLE _now; DROP TABLE _ids; DROP TABLE _strip;
  `,
];
