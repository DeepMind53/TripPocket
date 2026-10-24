import { WifiOff } from 'lucide-react';
import { cn } from '../../shared/lib/cn';

/**
 * 오프라인 안내 한 줄 — 지도·검색·후기 등 어디서나 같은 모양 (docs/20 U8).
 * 문구는 "무엇이 안 되는지 ⏎ 무엇은 되는지" 순서 (예: "지도는 온라인에서 보여요 ⏎ 일정·길찾기는 그대로 돼요")
 */
export function OfflineNote({ text, className }: { text: string; className?: string }) {
  return (
    <p
      role="status"
      className={cn('flex items-start gap-1.5 text-caption text-fg-muted', className)}
    >
      <WifiOff aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}
