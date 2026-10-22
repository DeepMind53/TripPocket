import { useEffect } from 'react';

/**
 * 하단 고정 요소(탭바, 저장 버튼 줄) 높이를 CSS 변수로 알려 토스트가 그 위에 뜨게 한다.
 * 여러 곳에서 겹쳐 써도 사라질 때 이전 값으로 되돌린다.
 */
export function useBottomInset(px: number) {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.getPropertyValue('--tp-bottom-inset');
    root.style.setProperty('--tp-bottom-inset', `${px}px`);
    return () => {
      if (prev) root.style.setProperty('--tp-bottom-inset', prev);
      else root.style.removeProperty('--tp-bottom-inset');
    };
  }, [px]);
}
