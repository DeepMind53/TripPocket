import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * 글 앞의 작은 선 아이콘 (사용자 요청 2026-11-04): 그림 이모지 대신 날씨·빠른 메뉴와 같은 단순한 모양.
 * 글 흐름 안에 들어가 줄바꿈·말줄임을 그대로 둔다
 */
export function InlineIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <Icon
      aria-hidden="true"
      className={cn('mr-1 inline size-4 shrink-0 align-[-3px]', className ?? 'text-primary')}
    />
  );
}
