import { describe, expect, it } from 'vitest';
import { NICKNAME_MAX, normalizeNickname } from './nickname';

describe('normalizeNickname', () => {
  it('앞뒤·연속 공백과 제어 문자를 정리한다', () => {
    expect(normalizeNickname('  진  하\n')).toBe('진 하');
    expect(normalizeNickname('a\u0000b​c')).toBe('abc');
  });

  it('비었거나 너무 길면 null, 이모지는 1글자로 센다', () => {
    expect(normalizeNickname('   ')).toBeNull();
    expect(normalizeNickname(123)).toBeNull();
    expect(normalizeNickname('가'.repeat(NICKNAME_MAX + 1))).toBeNull();
    expect(normalizeNickname('🧳'.repeat(NICKNAME_MAX))).toBe('🧳'.repeat(NICKNAME_MAX));
  });
});
