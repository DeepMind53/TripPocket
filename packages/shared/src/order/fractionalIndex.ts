/**
 * 정렬 키 (fractional indexing). docs/04 §1 "order"
 * 두 키 사이에 들어갈 새 키를 만들어, 순서를 바꿔도 옮긴 항목 하나만 저장하면 된다.
 * 키는 아래 문자로만 이루어지며 문자열 비교(코드 단위) 순서 = 정렬 순서.
 * 주의: 정렬은 localeCompare가 아니라 기본 비교(<)로 해야 한다.
 */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function digitIndex(ch: string): number {
  const i = DIGITS.indexOf(ch);
  if (i < 0) throw new Error(`정렬 키에 쓸 수 없는 문자: ${ch}`);
  return i;
}

/** a < 결과 < b 인 키. a는 빈 문자열(맨 앞) 가능, b가 null이면 맨 뒤 */
function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`정렬 키 순서가 잘못됨: ${a} >= ${b}`);
  if (a.endsWith('0') || (b !== null && b.endsWith('0'))) {
    throw new Error('정렬 키는 0으로 끝날 수 없어요');
  }

  if (b !== null) {
    // 공통 접두사는 그대로 두고 나머지에서 중간값을 찾는다
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }

  const digitA = a ? digitIndex(a[0] as string) : 0;
  const digitB = b !== null ? digitIndex(b[0] as string) : DIGITS.length;

  if (digitB - digitA > 1) {
    return DIGITS[Math.round((digitA + digitB) / 2)] as string;
  }
  // 바로 옆 자리면 한 자리 더 내려간다
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return (DIGITS[digitA] as string) + midpoint(a.slice(1), null);
}

/** prev와 next 사이 키. prev=null이면 맨 앞, next=null이면 맨 뒤 */
export function keyBetween(prev: string | null, next: string | null): string {
  return midpoint(prev ?? '', next);
}

/** prev와 next 사이에 고르게 n개 키 (초기 데이터·템플릿 일괄 생성용) */
export function keysBetween(prev: string | null, next: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [keyBetween(prev, next)];
  const mid = Math.floor(n / 2);
  const midKey = keyBetween(prev, next);
  return [...keysBetween(prev, midKey, mid), midKey, ...keysBetween(midKey, next, n - mid - 1)];
}

/** 정렬 비교 함수 (localeCompare 금지) */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
