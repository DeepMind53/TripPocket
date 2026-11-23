import { createContext, useContext, useEffect } from 'react';

/**
 * 입력 시트 닫힘 보호 (docs/31 A1·R1, 2026-11-23 사용자 결정: 바뀐 내용이 있을 때만 확인 창).
 * 시트(BottomSheetImpl)가 제공하고, 시트 안 양식이 쓴다. 시트 본체는 처음 열 때 불러오므로
 * 양식이 이 파일만 가져와도 첫 화면 크기가 늘지 않게 따로 둔다
 */
export interface SheetGuard {
  /** 양식이 "처음 연 값과 다름"을 알린다 */
  setDirty: (dirty: boolean) => void;
  /** [취소]처럼 직접 닫을 때 — 바뀐 내용이 있으면 먼저 묻는다 */
  requestClose: () => void;
}

export const SheetGuardContext = createContext<SheetGuard | null>(null);

/** 양식의 지금 값이 처음 값과 다른지 시트에 알린다 (시트 밖이면 아무 일 없음) */
export function useSheetDirty(dirty: boolean): void {
  const guard = useContext(SheetGuardContext);
  useEffect(() => {
    guard?.setDirty(dirty);
  }, [guard, dirty]);
  useEffect(() => () => guard?.setDirty(false), [guard]);
}

/** 바뀐 내용이 있으면 묻고 닫는 함수. 시트 밖이면 fallback을 그대로 부른다 */
export function useSheetClose(fallback: () => void): () => void {
  const guard = useContext(SheetGuardContext);
  return guard ? guard.requestClose : fallback;
}
