import { useEffect, useState, type ReactNode } from 'react';

/** 다음 것으로 넘어가는 간격 (사용자 요청 2026-11-10) */
const EVERY_MS = 3000;

/**
 * 한 칸에 여러 정보를 번갈아 (일정 날짜 머리 오른쪽: 날씨·오늘·Plan B). 새 것이 위에서 아래로 굴러 들어온다.
 * 하나뿐이면 그대로. 지금 안 보이는 것도 스크린리더에는 그대로 읽힌다 (sr-only)
 */
export function RollingSlot({ items }: { items: readonly ReactNode[] }) {
  const [i, setI] = useState(0);
  const n = items.length;
  useEffect(() => {
    if (n < 2) return;
    const id = window.setInterval(() => setI((x) => x + 1), EVERY_MS);
    return () => window.clearInterval(id);
  }, [n]);
  if (n === 0) return null;
  const at = i % n;
  return (
    <span className="relative flex h-7 shrink-0 items-center overflow-hidden">
      {items.map((node, k) => (
        <span
          key={k}
          className={
            k !== at ? 'sr-only' : n > 1 ? 'tp-roll flex items-center' : 'flex items-center'
          }
        >
          {node}
        </span>
      ))}
    </span>
  );
}
