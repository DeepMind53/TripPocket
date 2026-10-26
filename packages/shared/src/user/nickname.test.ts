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
  });

  it('10자까지, 한글·한자·영어·숫자만 (이모지·기호 안 됨)', () => {
    expect(NICKNAME_MAX).toBe(10);
    expect(normalizeNickname('김하늘')).toBe('김하늘');
    expect(normalizeNickname('JinHa Kim')).toBe('JinHa Kim');
    expect(normalizeNickname('金鎭夏')).toBe('金鎭夏');
    expect(normalizeNickname('하늘_2026')).toBe('하늘_2026');
    expect(normalizeNickname('가나다라마바사아자차')).toBe('가나다라마바사아자차');
    expect(normalizeNickname('가나다라마바사아자차카')).toBeNull();
    expect(normalizeNickname('여행🧳')).toBeNull();
    expect(normalizeNickname('<b>')).toBeNull();
  });
});
