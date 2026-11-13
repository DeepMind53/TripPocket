import type { LocalDate } from '@trippocket/shared';
import { useState } from 'react';
import { itemRepo } from '../../data/repositories/itemRepo';
import { parseBulkLines } from '../../domain/labTools';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button, toast } from '../../shared/ui';

/**
 * 여러 일정 붙여 넣기 (실험실 bulkAdd, 2026-11-13): 메모·카톡·블로그에서 복사한 일정을 한 줄에 하나씩 —
 * "10:00 센소지"처럼 시각이 앞에 있으면 시각도. 하루 메뉴에서 열고, 그날 맨 뒤에 장소 일정으로 넣는다
 */
export function BulkAddSheet({
  open,
  onOpenChange,
  tripId,
  date,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  date: LocalDate;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = parseBulkLines(text);
  const add = async () => {
    setBusy(true);
    try {
      for (const r of rows) await itemRepo.create({ tripId, date, kind: 'place', ...r });
      toast(t('tool.bulkAdded', { n: rows.length }));
      setText('');
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('tool.bulkTitle')}
      description={t('tool.bulkDesc')}
      footer={
        <Button fullWidth size="lg" disabled={!rows.length || busy} onClick={() => void add()}>
          {t('tool.bulkAdd', { n: rows.length })}
        </Button>
      }
    >
      <textarea
        aria-label={t('tool.bulkTitle')}
        value={text}
        rows={8}
        maxLength={3000}
        placeholder={t('tool.bulkPlaceholder')}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-btn border border-line bg-bg-subtle p-3 text-body-1 outline-none focus:border-primary"
      />
      {rows.length > 0 && (
        <ul aria-label={t('tool.bulkPreview')} className="mt-3 flex flex-col gap-1">
          {rows.map((r, i) => (
            <li key={`${i}-${r.title}`} className="flex gap-2 text-body-2">
              <span className="tabular w-24 shrink-0 text-fg-muted">
                {r.startTime ? `${r.startTime}${r.endTime ? `~${r.endTime}` : ''}` : '--:--'}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
