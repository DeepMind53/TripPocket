import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n';

/**
 * 현지인에게 보여 주는 큰 글씨 화면 (택시 카드·회화, docs/20 G4·G7).
 * 화면 가득, 오른쪽 위 X·뒤로 가기(ESC)로 닫음
 */
export function ShowCard({
  open,
  onClose,
  big,
  bigLang,
  en,
  sub,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** 크게 보여 줄 현지어 */
  big: string;
  /** 현지어 BCP 47 코드 — 언어별 글꼴(styles/index.css :lang)과 읽기 */
  bigLang?: string | undefined;
  /** 현지어 아래 영어 (현지어가 영어가 아니면 모든 카드에, 사용자 요청 2026-11-02) */
  en?: string | undefined;
  /** 아래 작은 한국어 등 */
  sub?: string | undefined;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={big}
      className="fixed inset-0 z-[70] flex flex-col bg-bg px-[max(20px,env(safe-area-inset-left))] pt-[max(16px,var(--safe-top))] pb-[max(24px,env(safe-area-inset-bottom))]"
    >
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className="grid size-11 place-items-center self-end rounded-full bg-bg-subtle"
      >
        <X aria-hidden="true" className="size-6" />
      </button>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p
          lang={bigLang}
          className="text-[clamp(1.75rem,8vw,3rem)] leading-tight font-semibold whitespace-pre-line [overflow-wrap:anywhere] [word-break:normal]"
        >
          {big}
        </p>
        {en && (
          <p
            lang="en"
            className="text-title-2 whitespace-pre-line text-fg-sub [overflow-wrap:anywhere]"
          >
            {en}
          </p>
        )}
        {children}
        {sub && <p className="text-body-1 whitespace-pre-line text-fg-sub">{sub}</p>}
      </div>
    </div>,
    document.body,
  );
}
