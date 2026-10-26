import { describe, expect, it } from 'vitest';
import { isExpiredTombstone } from './tombstone';

describe('지난 삭제 기록', () => {
  const now = Date.parse('2026-10-27T00:00:00Z');
  it('살아 있는 기록·7일 안의 삭제는 그대로 둔다', () => {
    expect(isExpiredTombstone({}, now)).toBe(false);
    expect(isExpiredTombstone({ deletedAt: '2026-10-25T00:00:00Z' }, now)).toBe(false);
  });
  it('7일 지난 삭제, 서버가 비운 삭제 표시는 지운다', () => {
    expect(isExpiredTombstone({ deletedAt: '2026-10-19T00:00:00Z' }, now)).toBe(true);
    expect(isExpiredTombstone({ deletedAt: '2026-10-26T00:00:00Z', purged: 1 }, now)).toBe(true);
  });
});
