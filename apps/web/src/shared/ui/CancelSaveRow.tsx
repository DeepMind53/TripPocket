import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';

/**
 * 저장·추가 버튼 왼쪽에 빨간 [취소] (사용자 요청 2026-11-02): 저장하지 않고 나가기.
 * 너비는 줄의 1/5, 나머지는 원래 버튼
 */
export function CancelSaveRow({
  onCancel,
  children,
}: {
  onCancel: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="w-1/5 shrink-0 rounded-btn bg-danger px-1 text-body-2 font-semibold text-white active:opacity-80"
      >
        {t('common.cancel')}
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
