import type { KeyboardEvent } from 'react';

/**
 * 저장·추가용 Enter인지 (docs/31 R4). 한글처럼 글자를 조합하는 중의 Enter는 글자 확정이라 빼야
 * 마지막 글자가 칸에 남거나 두 번 저장되지 않는다. 사파리는 조합 끝 Enter를 keyCode 229로 보낸다.
 * Enter 처리는 앞으로 이 함수만 쓴다 (docs/conventions/coding-rules.md)
 */
export function isSubmitEnter(e: KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229;
}
