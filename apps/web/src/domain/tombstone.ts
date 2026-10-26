/** 복원 기간(data/repositories/trashRepo TRASH_DAYS)과 같은 7일 */
export const TOMBSTONE_KEEP_MS = 7 * 86_400_000;

/**
 * 서버가 내용을 비운 삭제 표시(purged) 또는 복원 기간이 지난 삭제 기록인가
 * — 동기화로 받으면 기기에 두지 않고 바로 지운다 (서버는 지운 지 7일 지나면 내용을 비운다, 2026-10-27)
 */
export function isExpiredTombstone(
  r: { deletedAt?: unknown; purged?: unknown },
  now = Date.now(),
): boolean {
  if (typeof r.deletedAt !== 'string') return false;
  return r.purged === 1 || now - Date.parse(r.deletedAt) > TOMBSTONE_KEEP_MS;
}
