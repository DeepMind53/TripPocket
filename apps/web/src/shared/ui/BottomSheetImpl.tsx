import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../lib/cn';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { confirmAction } from './confirmStore';
import { SheetGuardContext, type SheetGuard } from './sheetGuard';
import { useSheetLayer } from './sheetStack';

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
  /** false = 다른 시트 위에 열려도 "뒤로"를 두지 않음 (확인 창처럼 버튼이 곧 답인 시트) */
  backButton?: boolean;
  /**
   * 입력이 처음 값과 다름 — 닫기 전에 "버릴까요?"를 묻는다 (docs/31 A1).
   * 시트 안 양식이 따로 있으면 그 안에서 useSheetDirty()를 써도 된다
   */
  dirty?: boolean;
  children: ReactNode;
  className?: string;
}

/** 안드로이드 뒤로 가기·Esc를 받는 브라우저 기능 (크롬 126+). 타입 정의가 아직 없어 필요한 만큼만 */
interface CloseWatcherLike {
  onclose: (() => void) | null;
  destroy: () => void;
}

/**
 * 모바일 편집 폼용 바텀시트 (docs/11 §7).
 * 바깥 탭·ESC·아래로 끌기·휴대폰 뒤로 가기로 닫힌다. 안의 양식이 바뀌었으면(useSheetDirty) 먼저 묻는다 (docs/31 A1·R1).
 * 뒤로 가기는 화면 기록을 건드리지 않고 CloseWatcher로 받는다 — 닫으면서 다른 화면으로 가는 시트(빠른 메뉴 등)와
 * 기록이 엉키지 않게. 지원하지 않는 브라우저(아이폰 등)는 지금처럼 앞 화면으로 간다 포커스는 시트 안에 갇히고 닫히면 트리거로 돌아간다.
 * 시트 위에 시트가 열리면 아래 시트는 숨기고 위 시트에 "뒤로"를 둔다 — 한 번에 하나만 보인다 (sheetStack.ts).
 */
export function BottomSheetImpl({
  open,
  onOpenChange,
  title,
  description,
  footer,
  headerAside,
  autoFocusInput = true,
  backButton = true,
  dirty: dirtyProp = false,
  children,
  className,
}: BottomSheetProps) {
  const { t } = useTranslation();
  const { covered, stacked } = useSheetLayer(open);
  const back = useRef<HTMLButtonElement>(null);
  // 손잡이를 위로 끌면 화면 가득, 아래로 끌면 원래 높이 → 닫기 (docs/16 I2, 2026-10-26 정식)
  const [full, setFull] = useState(false);
  if (!open && full) setFull(false);
  const dragY = useRef<number | null>(null);
  // 키보드가 뜨면 시트를 키보드 위로 올리고 보이는 칸 안에 맞춘다 (닉네임 입력 등, 사용자 요청 2026-11-02)
  const kb = useKeyboardInset(open);
  // 닫기 보호: 안 양식이 바뀌었으면 확인 창 (docs/31 A1). 늘 최신 onOpenChange를 부르게 ref로
  const dirty = useRef(false);
  const asking = useRef(false);
  const latest = useRef({ onOpenChange, dirtyProp });
  useEffect(() => {
    latest.current = { onOpenChange, dirtyProp };
  });
  const requestClose = useCallback(() => {
    if (!dirty.current && !latest.current.dirtyProp) {
      latest.current.onOpenChange(false);
      return;
    }
    if (asking.current) return;
    asking.current = true;
    void confirmAction({
      title: t('confirm.discardTitle'),
      message: t('confirm.discardBody'),
      ok: t('confirm.discard'),
      cancel: t('confirm.keepEditing'),
      danger: true,
    }).then((ok) => {
      asking.current = false;
      if (ok) latest.current.onOpenChange(false);
    });
  }, [t]);
  const guard = useMemo<SheetGuard>(
    () => ({
      setDirty: (d) => {
        dirty.current = d;
      },
      requestClose,
    }),
    [requestClose],
  );
  // 휴대폰 뒤로 가기 = 이 시트만 닫기 (docs/31 R1, §11 Q10 ①). 한 번 쓰면 없어지므로 남아 있으면 다시 만든다
  const [watchTurn, setWatchTurn] = useState(0);
  useEffect(() => {
    const Ctor = (globalThis as unknown as { CloseWatcher?: new () => CloseWatcherLike })
      .CloseWatcher;
    if (!open || !Ctor) return;
    const watcher = new Ctor();
    watcher.onclose = () => {
      requestClose();
      setWatchTurn((n) => n + 1);
    };
    return () => watcher.destroy();
  }, [open, watchTurn, requestClose]);
  const handleDrag = {
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
        else requestClose();
      }
    },
  };
  return (
    // 안 양식·아래 버튼 줄(footer) 모두 닫기 보호를 쓸 수 있게 시트 전체를 감싼다
    <SheetGuardContext value={guard}>
      <Dialog.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <Dialog.Portal>
          {/* 다른 시트 위에 열리면 어둡게 덮는 막은 아래 시트의 것 하나만 쓴다 (두 겹으로 어두워지지 않게) */}
          <Dialog.Overlay className={cn('tp-scrim fixed inset-0 z-40', !stacked && 'bg-scrim')} />
          <Dialog.Content
            {...(description ? {} : { 'aria-describedby': undefined })}
            // 보기용 시트는 열자마자 키보드가 뜨지 않게 시트 자체에 포커스
            onOpenAutoFocus={(e) => {
              const sheet = e.currentTarget as HTMLElement;
              if (autoFocusInput) {
                // "뒤로"가 첫 입력칸 대신 포커스를 받지 않게 건너뛴다
                if (!back.current) return;
                e.preventDefault();
                const first = [
                  ...sheet.querySelectorAll<HTMLElement>('button,input,select,textarea,[tabindex]'),
                ].find(
                  (el) =>
                    el !== back.current &&
                    el.tabIndex >= 0 &&
                    !el.hasAttribute('disabled') &&
                    el.getAttribute('type') !== 'hidden',
                );
                (first ?? sheet).focus();
                return;
              }
              e.preventDefault();
              sheet.focus();
            }}
            // 시트 안 양식의 제출은 시트 밖으로 올려 보내지 않는다 — React는 포털 너머 부모 양식까지 올려 보내서,
            // 예약 입력 시트 안 [최저가 비교]의 검색이 예약 저장까지 했다 (2026-11-11 고침)
            onSubmit={(e) => e.stopPropagation()}
            // 하단 알림(실행 취소 등)을 눌러도 시트가 닫히지 않게
            onPointerDownOutside={(e) => {
              if ((e.target as Element | null)?.closest('[data-toaster]')) e.preventDefault();
            }}
            className={cn(
              'tp-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-[560px] flex-col',
              'rounded-t-sheet bg-surface text-fg shadow-card outline-none',
              full && 'h-[90dvh]',
              // 위에 다른 시트가 열린 동안 숨긴다 (그려 둔 채라 입력하던 내용은 남는다)
              'transition-[opacity,visibility] duration-150 motion-reduce:transition-none',
              covered && 'invisible opacity-0',
              className,
            )}
            style={
              kb.inset > 0
                ? { bottom: kb.inset, maxHeight: `${(kb.height ?? 0) - 8}px` }
                : undefined
            }
          >
            <div
              aria-hidden="true"
              {...handleDrag}
              className={'shrink-0 cursor-grab touch-none py-3'}
            >
              <div className="mx-auto h-1 w-9 rounded-full bg-line" />
            </div>
            {stacked && backButton && (
              <button
                ref={back}
                type="button"
                onClick={requestClose}
                className="-mt-1 ml-1 flex min-h-11 shrink-0 items-center gap-1 self-start rounded-btn px-3 text-body-2 text-fg-sub active:bg-bg-subtle"
              >
                <ArrowLeft aria-hidden="true" className="size-5" />
                {t('header.back')}
              </button>
            )}
            <header
              className={cn('flex items-start gap-3 px-5 pb-3', !(stacked && backButton) && 'pt-2')}
            >
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
              <footer
                data-sheet-footer=""
                className="border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
              >
                {footer}
              </footer>
            ) : (
              <div className="pb-[env(safe-area-inset-bottom)]" />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </SheetGuardContext>
  );
}
