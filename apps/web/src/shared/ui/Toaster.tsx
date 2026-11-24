import { useEffect, useLayoutEffect, useRef } from 'react';
import { useToastStore, type ToastItem } from './toastStore';

const GAP = 8;

/**
 * 알림을 띄울 높이 (아래에서 px) — 가리면 안 되는 것 위로 (docs/31 B1):
 * 1) 열린 시트의 아래 버튼 줄(저장·취소) 2) 화면 아래쪽 반에 있는 ⚡ 버튼. 없으면 null(기본 자리)
 */
function avoidBottom(): number | null {
  const h = window.innerHeight;
  const footers = [...document.querySelectorAll<HTMLElement>('[data-sheet-footer]')].filter(
    (el) => el.getClientRects().length > 0,
  );
  const footer = footers.at(-1);
  if (footer) {
    const top = footer.getBoundingClientRect().top;
    if (top > 0 && top < h) return h - top + GAP;
  }
  const fab = document.querySelector<HTMLElement>('[data-quick-fab]');
  if (fab) {
    const top = fab.getBoundingClientRect().top;
    if (top > h / 2 && top < h) return h - top + GAP;
  }
  return null;
}

/** 앱 루트에 한 번 배치. 하단 탭바 위(--tp-bottom-inset)에, 시트 버튼 줄·⚡ 버튼이 있으면 그 위에 */
export function Toaster() {
  const items = useToastStore((s) => s.items);
  const box = useRef<HTMLDivElement>(null);
  // 화면 요소 위치를 재서 바로 스타일에 (렌더를 다시 돌리지 않게)
  useLayoutEffect(() => {
    if (items.length) box.current?.style.setProperty('--toast-lift', `${avoidBottom() ?? 0}px`);
  }, [items]);
  return (
    <div
      role="status"
      aria-live="polite"
      ref={box}
      data-toaster=""
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4"
      style={{
        bottom:
          'max(calc(var(--tp-bottom-inset) + 16px + env(safe-area-inset-bottom)), var(--toast-lift, 0px))',
      }}
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
  }, [item.id, item.duration, item.bump, dismiss]);

  return (
    <div
      // 시트가 열려 body가 클릭을 막아도(pointer-events: none) 알림은 눌려야 한다
      style={{ pointerEvents: 'auto' }}
      className="tp-toast flex min-h-12 items-center gap-3 rounded-btn bg-toast px-4 py-2.5 text-body-2 text-on-toast shadow-card"
    >
      <span className="flex-1">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="-mr-2 shrink-0 rounded-chip px-2 py-1.5 font-semibold text-primary"
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
