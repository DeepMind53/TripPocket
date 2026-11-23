import { useTranslation } from '../../i18n';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { closeConfirm, useConfirmStore } from './confirmStore';

/** 확인 창 — 로그인 안쪽 모든 화면에 하나 (app/AuthGate). confirmDelete()·confirmAction()이 연다 */
export function ConfirmHost() {
  const { t } = useTranslation();
  const open = useConfirmStore((s) => s.open);
  return (
    <BottomSheet
      open={open !== null}
      onOpenChange={(o) => !o && closeConfirm(false)}
      title={open?.title ?? t('confirm.title')}
      backButton={false}
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-body-2 whitespace-pre-line text-fg-sub">{open?.message}</p>
        <div className="grid grid-cols-2 gap-2">
          {/* 취소 = 회색, 확인(삭제) = 파랑 — 앱 전체 같은 규칙 (2026-11-03). 입력 버리기만 빨강 (docs/31 A1) */}
          <Button variant="cancel" onClick={() => closeConfirm(false)}>
            {open?.cancel ?? t('common.cancel')}
          </Button>
          <Button variant={open?.danger ? 'danger' : 'primary'} onClick={() => closeConfirm(true)}>
            {open?.ok ?? t('confirm.delete')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
