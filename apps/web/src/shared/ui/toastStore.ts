import { create } from 'zustand';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
  /** 표시 시간(ms) */
  duration: number;
}

interface ToastState {
  items: ToastItem[];
  show: (item: Omit<ToastItem, 'id'>) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;
// 한 번에 많이 쌓이지 않게 최근 3개만 유지
const MAX_VISIBLE = 3;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  show: (item) => {
    const id = nextId++;
    set((s) => ({ items: [...s.items, { ...item, id }].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/** 짧은 알림 — "복사했어요" (2초) */
export function toast(message: string): number {
  return useToastStore.getState().show({ message, duration: 2000 });
}

/** 실행 취소 등 행동이 붙은 알림 — "삭제했어요 [실행 취소]" (4초, docs/05 §7) */
export function snackbar(message: string, action?: ToastAction): number {
  return useToastStore
    .getState()
    .show(action ? { message, action, duration: 4000 } : { message, duration: 4000 });
}
