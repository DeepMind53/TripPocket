import { Zap } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';

/**
 * 빠른 메뉴 ⚡ 플로팅 버튼 — 누르면 메뉴, 누른 채 끌었다 놓으면 그 자리로 옮긴다.
 * 놓으면 가까운 옆 가장자리에 붙고, 위치는 이 기기에 저장 (화면마다 같은 자리).
 * 처음 자리: 오른쪽, 하단 탭 바로 위 (엄지 영역 — 2026-10-24 사용자 결정, docs/16 A1).
 * 스크롤하는 동안은 작고 흐리게(아래 내용을 가리지 않게), 멈추면 0.8초 뒤 원래대로.
 * 화면 목록 끝에는 버튼 높이만큼 여백(AppShell·TripLayout main)
 */
const SIZE = 52;
const EDGE = 16;
/** 하단 탭(약 64px) + 여유 — 탭을 가리지 않게 */
const BOTTOM_RESERVED = 84;
const TOP_RESERVED = 72;
const KEY = 'tp-quick-fab';
const DRAG_START = 8;

interface FabPos {
  side: 'left' | 'right';
  /** 버튼 위쪽 위치 / 화면 높이 (0~1) — 화면 크기가 바뀌어도 비슷한 자리 */
  y: number;
}
// y = 1 → 아래 한계(하단 탭 위)에 붙음
const DEFAULT: FabPos = { side: 'right', y: 1 };
const SETTLE_MS = 800;

function load(): FabPos {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as FabPos | null;
    if (v && (v.side === 'left' || v.side === 'right') && v.y >= 0 && v.y <= 1) return v;
  } catch {
    // 저장소를 못 쓰면 기본 자리
  }
  return DEFAULT;
}
const usePos = create<FabPos>(load);
function save(p: FabPos) {
  usePos.setState(p);
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 저장 못 해도 이번에는 그 자리
  }
}

const clampTop = (top: number, h: number) =>
  Math.min(Math.max(top, TOP_RESERVED), Math.max(TOP_RESERVED, h - BOTTOM_RESERVED - SIZE));

/** 스크롤 중이면 true (아래로 스크롤할 때만 — 위로 올리면 바로 원래대로) */
function useScrollingDown(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let timer = 0;
    const onScroll = () => {
      const y = window.scrollY;
      const down = y > last;
      last = y;
      window.clearTimeout(timer);
      setOn(down);
      if (down) timer = window.setTimeout(() => setOn(false), SETTLE_MS);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
    };
  }, []);
  return on;
}

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

export function FloatingQuickButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  const pos = usePos();
  const vp = useViewport();
  const compact = useScrollingDown();
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  /** 끌기로 끝난 누름은 클릭(메뉴 열기)으로 치지 않는다 */
  const swallowClick = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < DRAG_START) return;
    s.moved = true;
    setDrag({ x: e.clientX - SIZE / 2, y: e.clientY - SIZE / 2 });
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    start.current = null;
    if (!s?.moved) return;
    swallowClick.current = true;
    setDrag(null);
    const top = clampTop(e.clientY - SIZE / 2, vp.h);
    save({ side: e.clientX < vp.w / 2 ? 'left' : 'right', y: top / vp.h });
  };

  const top = drag ? drag.y : clampTop(pos.y * vp.h, vp.h);
  const sideStyle = drag
    ? { left: Math.min(Math.max(drag.x, 0), vp.w - SIZE) }
    : pos.side === 'left'
      ? { left: `max(${EDGE}px, env(safe-area-inset-left, 0px))` }
      : { right: `max(${EDGE}px, env(safe-area-inset-right, 0px))` };

  return createPortal(
    <button
      type="button"
      aria-label={label}
      data-dragging={drag ? '' : undefined}
      data-compact={compact && !drag ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
        setDrag(null);
      }}
      onClick={() => {
        if (swallowClick.current) {
          swallowClick.current = false;
          return;
        }
        onOpen();
      }}
      style={{ top, width: SIZE, height: SIZE, ...sideStyle }}
      className="fixed z-40 grid touch-none place-items-center rounded-full bg-primary text-on-primary shadow-lg transition-[left,right,top,scale,opacity] duration-200 select-none data-[compact]:scale-75 data-[compact]:opacity-60 data-[dragging]:scale-110 data-[dragging]:transition-none [&>svg]:size-6"
    >
      <Zap aria-hidden="true" />
    </button>,
    document.body,
  );
}
