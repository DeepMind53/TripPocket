import { useEffect } from 'react';

/** 하단 고정 탭바 높이를 CSS 변수로 알려 토스트가 탭바 위에 뜨게 한다 */
export function useBottomInset(px: number) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tp-bottom-inset', `${px}px`);
    return () => {
      root.style.removeProperty('--tp-bottom-inset');
    };
  }, [px]);
}
