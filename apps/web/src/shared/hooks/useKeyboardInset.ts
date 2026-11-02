import { useEffect, useState } from 'react';

/**
 * 휴대폰 키보드가 가리는 아래쪽 높이(px)와 보이는 화면 높이.
 * 안드로이드 Chrome·아이폰 Safari는 키보드가 떠도 화면 아래에 붙은 요소를 올려 주지 않아서
 * visualViewport(키보드를 뺀 실제 보이는 칸)로 계산한다. active = false면 듣지 않는다
 */
export function useKeyboardInset(active: boolean): { inset: number; height: number | null } {
  const [state, setState] = useState<{ inset: number; height: number | null }>({
    inset: 0,
    height: null,
  });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // 주소창이 줄어드는 정도(수십 px)는 키보드로 보지 않는다
      const next =
        inset > 80 ? { inset, height: Math.round(vv.height) } : { inset: 0, height: null };
      setState((cur) => (cur.inset === next.inset && cur.height === next.height ? cur : next));
      // 입력칸을 보이는 곳으로 올리는 일은 useKeyboardScroll이 한다 (위쪽으로 — 아래 검색 결과·버튼 자리)
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setState({ inset: 0, height: null });
    };
  }, [active]);
  return state;
}
