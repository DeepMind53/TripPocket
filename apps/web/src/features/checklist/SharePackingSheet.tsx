import type { ChecklistItem } from '@trippocket/shared';
import { useState } from 'react';
import { checklistRepo } from '../../data/repositories/checklistRepo';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button, toast } from '../../shared/ui';

/**
 * 내 준비물 중 일행에게 보여 줄 것 고르기 (사용자 요청 2026-10-27): 항목마다·그룹 전체 체크.
 * 체크한 것만 일행 화면 "일행이 공유한 준비물"에 보인다 (일행은 보기·내 목록에 담기만)
 */
export function SharePackingSheet({
  open,
  onOpenChange,
  tripId,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  /** 저장된 내 준비물 */
  items: readonly ChecklistItem[];
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Set<string> | null>(null);
  // 시트를 열 때마다 지금 공유 중인 것에서 시작
  const chosen = picked ?? new Set(items.filter((i) => i.shared).map((i) => i.id));
  const groups = [...new Set(items.map((i) => i.category ?? ''))].map((name) => ({
    name,
    items: items.filter((i) => (i.category ?? '') === name),
  }));
  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(chosen);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    setPicked(next);
  };
  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setPicked(null);
        onOpenChange(o);
      }}
      title={t('checklist.share.title')}
    >
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-caption whitespace-pre-line text-fg-sub">{t('checklist.share.desc')}</p>
        {items.length === 0 && (
          <p className="text-body-2 text-fg-muted">{t('checklist.share.empty')}</p>
        )}
        {groups.map((g) => {
          const ids = g.items.map((i) => i.id);
          const all = ids.every((id) => chosen.has(id));
          const name = g.name || t('checklist.share.noGroup');
          return (
            <fieldset
              key={g.name}
              className="flex flex-col gap-1 rounded-card border border-line p-3"
            >
              <legend className="sr-only">{name}</legend>
              <label className="flex min-h-10 items-center gap-2 text-body-2 font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--tp-primary)]"
                  checked={all}
                  onChange={(e) => toggle(ids, e.target.checked)}
                  aria-label={t('checklist.share.group', { name })}
                />
                {name}
              </label>
              {g.items.map((i) => (
                <label key={i.id} className="flex min-h-10 items-center gap-2 pl-7 text-body-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--tp-primary)]"
                    checked={chosen.has(i.id)}
                    onChange={(e) => toggle([i.id], e.target.checked)}
                  />
                  {i.text}
                </label>
              ))}
            </fieldset>
          );
        })}
        <Button
          fullWidth
          onClick={() =>
            void checklistRepo.setShared(tripId, chosen).then(() => {
              toast(t('checklist.share.saved', { n: chosen.size }));
              setPicked(null);
              onOpenChange(false);
            })
          }
        >
          {t('checklist.share.save', { n: chosen.size })}
        </Button>
      </div>
    </BottomSheet>
  );
}
