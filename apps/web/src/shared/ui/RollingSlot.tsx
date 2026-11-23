import { cn } from '../lib/cn';
import { useSyncExternalStore, type ReactNode } from 'react';

/** 다음 것으로 넘어가는 간격 (사용자 요청 2026-11-10) */
const EVERY_MS = 3000;

/*
 * 앱 전체가 함께 보는 시계 하나 (docs/31 §11 R2, 2026-11-23).
 * 칸마다 따로 타이머를 돌리면 늦게 뜬 칸(날씨는 화면이 뜬 뒤 도착)이 박자가 어긋나고,
 * 겹친 전광판은 같은 박자로 돌아 어떤 항목이 영원히 숨는다. 모든 칸이 같은 순간에 넘어가게 한다.
 * 화면이 안 보이는 동안은 멈추고, 보는 칸이 하나도 없으면 처음(0)으로 돌아간다
 */
let tick = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();

function start() {
  if (timer !== undefined || document.hidden) return;
  timer = window.setInterval(() => {
    tick += 1;
    listeners.forEach((f) => f());
  }, EVERY_MS);
}
function stop() {
  window.clearInterval(timer);
  timer = undefined;
}
function onVisibility() {
  if (document.hidden) stop();
  else start();
}
function subscribe(f: () => void) {
  listeners.add(f);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', onVisibility);
    start();
  }
  return () => {
    listeners.delete(f);
    if (listeners.size === 0) {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      tick = 0;
    }
  };
}
const still = () => () => {};
const read = () => tick;

/**
 * 한 칸에 여러 정보를 번갈아 (일정 날짜 머리 오른쪽: 날씨·오늘·Plan B). 새 것이 위에서 아래로 굴러 들어온다.
 * 하나뿐이면 그대로. 지금 안 보이는 것도 스크린리더에는 그대로 읽힌다 (sr-only)
 */
export function RollingSlot({
  items,
  className,
  reserve = false,
}: {
  items: readonly ReactNode[];
  /** 칸 크기 등 (예: 가장 긴 것에 맞춘 최소 폭 — 바뀔 때 옆 요소가 움직이지 않게) */
  className?: string;
  /**
   * 칸 폭을 가장 넓은 항목에 맞춰 고정 — 바뀔 때 옆 요소가 좌우로 움직이지 않게 (사용자 요청 2026-11-23).
   * 모든 항목을 같은 격자 칸에 보이지 않게 겹쳐 자리를 잡는다
   */
  reserve?: boolean;
}) {
  const n = items.length;
  const now = useSyncExternalStore(n > 1 ? subscribe : still, read);
  if (n === 0) return null;
  const at = now % n;
  const cell = reserve ? 'col-start-1 row-start-1 justify-center ' : '';
  return (
    <span
      className={cn(
        'relative h-7 shrink-0 items-center overflow-hidden',
        reserve ? 'inline-grid' : 'flex',
        className,
      )}
    >
      {reserve &&
        n > 1 &&
        items.map((node, k) => (
          <span key={`r${k}`} aria-hidden="true" className={`${cell}invisible flex items-center`}>
            {node}
          </span>
        ))}
      {items.map((node, k) => (
        <span
          key={k}
          className={
            k !== at
              ? 'sr-only'
              : `${cell}${n > 1 ? 'tp-roll flex items-center' : 'flex items-center'}`
          }
        >
          {node}
        </span>
      ))}
    </span>
  );
}
