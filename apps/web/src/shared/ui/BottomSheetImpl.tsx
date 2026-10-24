import * as Dialog from '@radix-ui/react-dialog';
import { useRef, useState, type ReactNode } from 'react';
import { useLab } from '../../data/labsStore';
import { cn } from '../lib/cn';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 제목 아래 보조 설명 (스크린리더에도 읽힘) */
  description?: string;
  /** 하단 고정 영역 (예: [일정에 추가] 버튼) */
  footer?: ReactNode;
  /** 제목 오른쪽 작은 자리 (예: 후기 버튼) */
  headerAside?: ReactNode;
  /** false = 열 때 입력칸에 포커스를 주지 않음 (휴대폰 키보드가 바로 뜨지 않게) */
  autoFocusInput?: boolean;
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
  headerAside,
  autoFocusInput = true,
  children,
  className,
}: BottomSheetProps) {
  // 실험실 I2: 손잡이를 위로 끌면 화면 가득, 아래로 끌면 원래 높이 → 닫기
  const resizable = useLab('sheetResize');
  const [full, setFull] = useState(false);
  if (!open && full) setFull(false);
  const dragY = useRef<number | null>(null);
  const handleDrag = resizable
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          dragY.current = e.clientY;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        },
        onPointerUp: (e: React.PointerEvent) => {
          if (dragY.current === null) return;
          const dy = e.clientY - dragY.current;
          dragY.current = null;
          if (dy < -40) setFull(true);
          else if (dy > 40) {
            if (full) setFull(false);
            else onOpenChange(false);
          }
        },
      }
    : {};
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tp-scrim fixed inset-0 z-40 bg-scrim" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          // 보기용 시트는 열자마자 키보드가 뜨지 않게 시트 자체에 포커스
          onOpenAutoFocus={(e) => {
            if (autoFocusInput) return;
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          // 하단 알림(실행 취소 등)을 눌러도 시트가 닫히지 않게
          onPointerDownOutside={(e) => {
            if ((e.target as Element | null)?.closest('[data-toaster]')) e.preventDefault();
          }}
          className={cn(
            'tp-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-[560px] flex-col',
            'rounded-t-sheet bg-surface text-fg shadow-card outline-none',
            full && 'h-[90dvh]',
            className,
          )}
        >
          <div
            aria-hidden="true"
            {...handleDrag}
            className={cn('shrink-0 pt-2 pb-1', resizable && 'cursor-grab touch-none py-3')}
          >
            <div className="mx-auto h-1 w-9 rounded-full bg-line" />
          </div>
          <header className="flex items-start gap-3 px-5 pt-2 pb-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-title-2">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-caption text-fg-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {headerAside && <div className="shrink-0">{headerAside}</div>}
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
