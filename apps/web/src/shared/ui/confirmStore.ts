import { create } from 'zustand';

export interface ConfirmOptions {
  /** 설명 (줄바꿈 = 문장 구분) */
  message: string;
  /** 없으면 "삭제할까요?" */
  title?: string;
  /** 확인 버튼 글자 (없으면 "삭제") */
  ok?: string;
  /** 취소 버튼 글자 (없으면 "취소") */
  cancel?: string;
  /** 확인 버튼을 빨강으로 (입력 버리기처럼 되돌릴 수 없는 일) */
  danger?: boolean;
}

interface ConfirmState {
  /** 열린 확인 창 (null = 닫힘) */
  open: ConfirmOptions | null;
  resolve: ((ok: boolean) => void) | null;
}

export const useConfirmStore = create<ConfirmState>(() => ({ open: null, resolve: null }));

/** 확인 창을 띄우고 답을 기다린다. 이미 열려 있으면 앞의 것은 취소로 닫는다 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  useConfirmStore.getState().resolve?.(false);
  return new Promise((resolve) => useConfirmStore.setState({ open: options, resolve }));
}

/**
 * 지우기 전에 한 번 더 묻는다 (사용자 요청 2026-10-27 — 실수로 지우지 않게).
 * 확인 창(ConfirmHost)에서 [삭제]를 누르면 true
 */
export function confirmDelete(message: string): Promise<boolean> {
  return confirmAction({ message });
}

export function closeConfirm(ok: boolean): void {
  const { resolve } = useConfirmStore.getState();
  useConfirmStore.setState({ open: null, resolve: null });
  resolve?.(ok);
}
