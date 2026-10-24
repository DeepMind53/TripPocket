import type { Config } from '../config';
import type { Db } from '../db/database';

/**
 * 관리자 고정 목록 (2026-10-24 사용자 결정): ADMIN_ACCOUNTS = "kakao:123,naver:abc,google:xyz".
 * 설정돼 있으면 목록의 로그인 계정과 연결된 사용자만 관리자이고, 나머지는 관리자가 아니다.
 * 서버가 켜질 때와 로그인할 때마다 맞춘다. 비어 있으면 예전 규칙(첫 계정 = 관리자, 탈퇴 시 넘김)
 */
export function fixedAdmins(config: Config): string[] {
  return (config.ADMIN_ACCOUNTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^(kakao|naver|google):.+$/.test(s));
}

export function syncAdmins(db: Db, config: Config): void {
  const list = fixedAdmins(config);
  if (list.length === 0) return;
  const marks = list.map(() => '?').join(',');
  db.prepare(
    `UPDATE users SET is_admin = CASE WHEN id IN (
       SELECT user_id FROM oauth_accounts WHERE provider || ':' || provider_user_id IN (${marks})
     ) THEN 1 ELSE 0 END`,
  ).run(...list);
}
