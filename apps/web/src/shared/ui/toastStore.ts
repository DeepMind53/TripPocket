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
  /** 같은 알림이 다시 오면 늘린다 — 표시 시간을 처음부터 다시 센다 */
  bump?: number;
}

interface ToastState {
  items: ToastItem[];
  show: (item: Omit<ToastItem, 'id'>) => number;
  dismiss: (id: number) => void;
  /** [실행 취소] 없는 알림만 닫기 — 시트가 열릴 때 (docs/31 B1) */
  dismissPlain: () => void;
}

let nextId = 1;

/**
 * 알림은 쌓지 않는다 (docs/31 B1, 2026-11-25):
 * - 같은 문구가 떠 있으면 새로 띄우지 않고 시간만 다시 센다
 * - 새 알림이 오면 앞의 일반 알림은 바로 닫는다. [실행 취소]가 붙은 알림은 남은 시간 동안 남긴다 (가장 최근 하나)
 */
export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  show: (item) => {
    const same = get().items.find((t) => t.message === item.message && !t.action === !item.action);
    if (same) {
      set((s) => ({
        items: s.items.map((t) => (t.id === same.id ? { ...t, bump: (t.bump ?? 0) + 1 } : t)),
      }));
      return same.id;
    }
    const id = nextId++;
    set((s) => {
      const undo = s.items.filter((t) => t.action);
      const keep = item.action ? [] : undo.slice(-1);
      return { items: [...keep, { ...item, id }] };
    });
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
  dismissPlain: () => set((s) => ({ items: s.items.filter((t) => t.action) })),
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
