import { Copy } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { copyText } from '../../shared/lib/clipboard';
import { BottomSheet, Button } from '../../shared/ui';
import { monthlyUpdateRequest } from './monthlyUpdate.ko';

/** 관리자 월간 갱신 안내 — 요청문을 그대로 보여 주고 [복사] (사용자 요청 2026-10-27) */
export function MonthlyUpdateSheet({
  open,
  onOpenChange,
  month,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "2026-11" */
  month: string;
}) {
  const { t } = useTranslation();
  const text = monthlyUpdateRequest(month);
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('monthly.title')}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-caption whitespace-pre-line text-fg-sub">{t('monthly.desc')}</p>
        <pre className="max-h-[45vh] overflow-y-auto rounded-card bg-bg-subtle p-3 text-caption whitespace-pre-wrap text-fg">
          {text}
        </pre>
        <Button
          fullWidth
          leading={<Copy aria-hidden="true" className="size-4" />}
          onClick={() => void copyText(text, t('monthly.copied'))}
        >
          {t('monthly.copy')}
        </Button>
      </div>
    </BottomSheet>
  );
}
