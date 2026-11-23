import { cn } from '../lib/cn';
import { useEffect, useState, type ReactNode } from 'react';

/** 다음 것으로 넘어가는 간격 (사용자 요청 2026-11-10) */
const EVERY_MS = 3000;

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
  const [i, setI] = useState(0);
  const n = items.length;
  useEffect(() => {
    if (n < 2) return;
    const id = window.setInterval(() => setI((x) => x + 1), EVERY_MS);
    return () => window.clearInterval(id);
  }, [n]);
  if (n === 0) return null;
  const at = i % n;
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
