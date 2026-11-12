import { useId, useLayoutEffect, useState } from 'react';
import { create } from 'zustand';

/** 열려 있는 시트 순서 (맨 뒤 = 지금 보이는 시트) */
const useSheetStack = create<{ ids: string[] }>(() => ({ ids: [] }));

/**
 * 시트는 한 번에 하나만 보인다 (사용자 요청 2026-11-12 — 창 위에 또 창이 뜨면 헷갈림).
 * covered = 이 시트 위에 다른 시트가 열림 → 숨긴다 (입력하던 내용은 그대로 둔다)
 * stacked = 다른 시트 위에 열림 → "뒤로"를 보여 준다. 닫히는 동안에도 값을 그대로 둔다 (내려가는 중에 모양이 바뀌지 않게)
 */
export function useSheetLayer(open: boolean): { covered: boolean; stacked: boolean } {
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    useSheetStack.setState((s) => ({ ids: [...s.ids, id] }));
    return () => useSheetStack.setState((s) => ({ ids: s.ids.filter((x) => x !== id) }));
  }, [open, id]);
  const at = useSheetStack((s) => s.ids.indexOf(id));
  const covered = useSheetStack((s) => at >= 0 && at < s.ids.length - 1);
  const [stacked, setStacked] = useState(false);
  if (at >= 0 && stacked !== at > 0) setStacked(at > 0);
  return { covered, stacked };
}
