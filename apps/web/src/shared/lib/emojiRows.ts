import { flagEmoji } from '@trippocket/shared';
import { COUNTRY_EMOJIS, DEFAULT_EMOJIS } from './coverColors';

/**
 * 여행 이모지 고르기 줄 (사용자 요청 2026-10-27): 첫 줄 = 여행 나라 국기 + 그 나라 이모지 5종(첫 나라 기준),
 * 다음 줄 = 공통 10종. 순서는 고정 — 고른 이모지가 맨 앞으로 옮겨 가지 않는다.
 * 지금 이모지가 어느 줄에도 없으면(예전에 고른 것) 공통 줄 맨 끝에 붙인다
 */
export function emojiRows(
  countryCodes: readonly string[],
  current?: string,
): { country: string[]; common: string[] } {
  const codes = [...new Set(countryCodes)];
  const country = [
    ...new Set([...codes.map(flagEmoji), ...(codes[0] ? (COUNTRY_EMOJIS[codes[0]] ?? []) : [])]),
  ];
  const common = (DEFAULT_EMOJIS as readonly string[]).filter((e) => !country.includes(e));
  if (current && !country.includes(current) && !common.includes(current)) common.push(current);
  return { country, common };
}
