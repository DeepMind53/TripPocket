import { create } from 'zustand';

interface ConfirmState {
  /** 열린 확인 창의 설명 (null = 닫힘) */
  message: string | null;
  resolve: ((ok: boolean) => void) | null;
}

export const useConfirmStore = create<ConfirmState>(() => ({ message: null, resolve: null }));

/**
 * 지우기 전에 한 번 더 묻는다 (사용자 요청 2026-10-27 — 실수로 지우지 않게).
 * 확인 창(ConfirmHost)에서 [삭제]를 누르면 true. 이미 열려 있으면 앞의 것은 취소로 닫는다
 */
export function confirmDelete(message: string): Promise<boolean> {
  useConfirmStore.getState().resolve?.(false);
  return new Promise((resolve) => useConfirmStore.setState({ message, resolve }));
}

export function closeConfirm(ok: boolean): void {
  const { resolve } = useConfirmStore.getState();
  useConfirmStore.setState({ message: null, resolve: null });
  resolve?.(ok);
}
