import { useTranslation } from '../../i18n';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { closeConfirm, useConfirmStore } from './confirmStore';

/** 삭제 확인 창 — 로그인 안쪽 모든 화면에 하나 (app/AuthGate). confirmDelete()가 연다 */
export function ConfirmHost() {
  const { t } = useTranslation();
  const message = useConfirmStore((s) => s.message);
  return (
    <BottomSheet
      open={message !== null}
      onOpenChange={(o) => !o && closeConfirm(false)}
      title={t('confirm.title')}
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-body-2 whitespace-pre-line text-fg-sub">{message}</p>
        <div className="grid grid-cols-2 gap-2">
          {/* 취소 = 빨강, 확인(삭제) = 파랑 — 앱 전체 같은 규칙 (2026-11-03) */}
          <Button variant="cancel" onClick={() => closeConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => closeConfirm(true)}>{t('confirm.delete')}</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
