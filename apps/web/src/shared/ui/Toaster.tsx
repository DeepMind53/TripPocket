import { useEffect } from 'react';
import { useToastStore, type ToastItem } from './toastStore';

/** 앱 루트에 한 번 배치. 하단 탭바 위(--tp-bottom-inset)에 표시된다. */
export function Toaster() {
  const items = useToastStore((s) => s.items);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4"
      style={{ bottom: 'calc(var(--tp-bottom-inset) + 16px + env(safe-area-inset-bottom))' }}
    >
      {items.map((item) => (
        <ToastView key={item.id} item={item} />
      ))}
    </div>
  );
}

function ToastView({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.id, item.duration, dismiss]);

  return (
    <div className="tp-toast pointer-events-auto flex min-h-12 items-center gap-3 rounded-btn bg-toast px-4 py-2.5 text-body-2 text-on-toast shadow-card">
      <span className="flex-1">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="-mr-2 shrink-0 rounded-lg px-2 py-1.5 font-bold text-primary"
          onClick={() => {
            item.action?.onAction();
            dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  );
}
