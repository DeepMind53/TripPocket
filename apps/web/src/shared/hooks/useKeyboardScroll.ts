import { useEffect } from 'react';

const TEXT_TYPES = new Set(['text', 'search', 'tel', 'url', 'email', 'number', '']);

/**
 * 휴대폰에서 입력칸을 누르면 자판이 뜬 뒤 그 칸을 보이는 화면 위쪽으로 올린다 (사용자 요청 2026-11-02).
 * 아래에 뜨는 장소 검색 결과·[장소 검색] 버튼·저장 버튼이 자판이나 서로에 가려지지 않게.
 * 화면 크기·자판 높이가 폰마다 달라서 자판이 다 뜬 뒤(visualViewport) 실제 보이는 높이로 판단한다.
 * 이미 위쪽 45% 안에 있으면 움직이지 않는다 (scroll-margin-top은 index.css)
 */
export function useKeyboardScroll(): void {
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    let timer = 0;
    const onFocus = (e: FocusEvent) => {
      const el = e.target;
      const ok =
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement && TEXT_TYPES.has(el.type));
      if (!ok) return;
      window.clearTimeout(timer);
      // 자판이 올라오는 동안 기다렸다가
      timer = window.setTimeout(() => {
        if (document.activeElement !== el) return;
        // 시트 안 입력칸: 시트가 자판 위로 올라가니 시트 안에서만 보이게 (화면 전체를 밀면 저장 버튼이 가려진다)
        if (el.closest('[role=dialog]')) {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return;
        }
        const visible = window.visualViewport?.height ?? window.innerHeight;
        const r = el.getBoundingClientRect();
        if (r.top >= 0 && r.bottom <= visible * 0.45) return;
        el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 350);
    };
    document.addEventListener('focusin', onFocus);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);
}
