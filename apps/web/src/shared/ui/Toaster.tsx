import { useEffect, useLayoutEffect, useRef } from 'react';
import { useToastStore, type ToastItem } from './toastStore';

const GAP = 8;

/**
 * 알림을 띄울 높이 (아래에서 px) — 열린 시트의 아래 버튼 줄(저장·취소)을 가리지 않게 그 위로 (docs/31 B1). 없으면 null(기본 자리)
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
  return null;
}

/** 알림 줄 안쪽 여백 (px-4) */
const PAD = 16;

/**
 * ⚡ 버튼을 가리지 않게 (docs/31 B1, 2026-11-26 사용자 요청 "빠른 메뉴 위쪽에 뜬다"): 위로 올리지 않고,
 * 알림 줄과 ⚡ 버튼이 같은 높이에서 겹치면 버튼이 있는 쪽만 비워 옆에 나란히 띄운다
 */
function besideFab(el: HTMLElement | null) {
  if (!el) return;
  el.style.paddingLeft = '';
  el.style.paddingRight = '';
  const fab = document.querySelector<HTMLElement>('[data-quick-fab]');
  if (!fab || fab.getClientRects().length === 0) return;
  const f = fab.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  if (b.height === 0 || f.top >= b.bottom || f.bottom <= b.top) return;
  if (f.left + f.width / 2 > b.left + b.width / 2) {
    const extra = b.right - PAD - (f.left - GAP);
    if (extra > 0) el.style.paddingRight = `${PAD + extra}px`;
  } else {
    const extra = f.right + GAP - (b.left + PAD);
    if (extra > 0) el.style.paddingLeft = `${PAD + extra}px`;
  }
}

/** 하단 탭 바로 위 (탭이 없는 화면은 화면 아래) */
const TAB_BOTTOM = 'calc(var(--tp-bottom-inset) + 16px + env(safe-area-inset-bottom))';

/**
 * 앱 루트에 한 번 배치. 하단 탭바 위(--tp-bottom-inset)에, 시트 버튼 줄이 있으면 그 위에. ⚡ 버튼과 겹치면 그 옆에.
 * 고정 알림(업데이트 안내, pinned)은 늘 하단 탭 바로 위 — 일반 알림은 그 위로 쌓는다 (2026-11-26)
 */
export function Toaster() {
  const items = useToastStore((s) => s.items);
  const pinned = items.filter((i) => i.pinned);
  const normal = items.filter((i) => !i.pinned);
  const box = useRef<HTMLDivElement>(null);
  const pinBox = useRef<HTMLDivElement>(null);
  // 화면 요소 위치를 재서 바로 스타일에 (렌더를 다시 돌리지 않게)
  useLayoutEffect(() => {
    if (!items.length) return;
    box.current?.style.setProperty('--toast-lift', `${avoidBottom() ?? 0}px`);
    const h = pinBox.current?.offsetHeight ?? 0;
    box.current?.style.setProperty('--toast-pin', `${h ? h + GAP : 0}px`);
    besideFab(pinBox.current);
    // 시트 버튼 줄을 피해 올라간 때는 ⚡ 버튼과 겹칠 일이 없다
    if (!box.current?.style.getPropertyValue('--toast-lift').startsWith('0')) return;
    besideFab(box.current);
  }, [items]);
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        ref={box}
        data-toaster=""
        className="pointer-events-none fixed inset-x-0 z-[80] mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4"
        style={{
          bottom: `max(calc(${TAB_BOTTOM} + var(--toast-pin, 0px)), var(--toast-lift, 0px))`,
        }}
      >
        {normal.map((item) => (
          <ToastView key={item.id} item={item} />
        ))}
      </div>
      {pinned.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          ref={pinBox}
          data-toaster-pinned=""
          className="pointer-events-none fixed inset-x-0 z-[80] mx-auto flex w-full max-w-[560px] flex-col gap-2 px-4"
          style={{ bottom: TAB_BOTTOM }}
        >
          {pinned.map((item) => (
            <ToastView key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
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
