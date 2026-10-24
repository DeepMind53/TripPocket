import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 제목 아래 보조 설명 (스크린리더에도 읽힘) */
  description?: string;
  /** 하단 고정 영역 (예: [일정에 추가] 버튼) */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * 모바일 편집 폼용 바텀시트 (docs/11 §7).
 * 바깥 탭·ESC로 닫힌다 (뒤로가기 연동은 3단계). 포커스는 시트 안에 갇히고 닫히면 트리거로 돌아간다.
 */
export function BottomSheetImpl({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
}: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tp-scrim fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          // 하단 알림(실행 취소 등)을 눌러도 시트가 닫히지 않게
          onPointerDownOutside={(e) => {
            if ((e.target as Element | null)?.closest('[data-toaster]')) e.preventDefault();
          }}
          className={cn(
            'tp-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-[560px] flex-col',
            'rounded-t-sheet bg-surface text-fg shadow-card outline-none',
            className,
          )}
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-line"
          />
          <header className="px-5 pt-2 pb-3">
            <Dialog.Title className="text-title-2">{title}</Dialog.Title>
            {description && (
              <Dialog.Description className="mt-1 text-caption text-fg-muted">
                {description}
              </Dialog.Description>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer ? (
            <footer className="border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          ) : (
            <div className="pb-[env(safe-area-inset-bottom)]" />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
