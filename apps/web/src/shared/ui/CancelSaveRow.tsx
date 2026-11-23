import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../lib/cn';
import { Button } from './Button';

/**
 * 저장·추가 버튼 왼쪽에 [취소] (사용자 요청 2026-11-02, 색은 2026-11-23 회색): 저장하지 않고 나가기.
 * 너비는 줄의 1/5, 나머지는 원래 버튼. 시트 안에서는 스크롤해도 아래에 붙어 있다
 */
export function CancelSaveRow({
  onCancel,
  children,
  docked = false,
}: {
  onCancel: () => void;
  children: ReactNode;
  /**
   * 시트 본문(스크롤 영역) 안에 둘 때: 시트 폭 끝까지 + 위 구분선 + 아래 틈(본문 아래 여백 16px)을 메운다.
   * 안 메우면 버튼 아래로 뒤의 입력칸이 비쳐 보인다 (사용자 요청 2026-11-23)
   */
  docked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    // 긴 입력 시트에서도 늘 보이게 아래에 붙인다: 자판이 떠도 저장·취소가 가려지지 않게 (사용자 요청 2026-11-04)
    <div
      className={cn(
        'sticky bottom-0 z-10 flex items-stretch gap-2 bg-surface',
        docked
          ? '-mx-5 border-t border-line px-5 pt-3 shadow-[0_16px_0_var(--color-surface)]'
          : '-mb-1 py-1',
      )}
    >
      <Button
        variant="cancel"
        onClick={onCancel}
        className="h-auto! w-1/5 shrink-0 px-1! whitespace-nowrap"
      >
        {t('common.cancel')}
      </Button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
