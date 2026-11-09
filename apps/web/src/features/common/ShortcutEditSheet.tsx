import { Check } from 'lucide-react';
import { useState } from 'react';
import { useLabs } from '../../data/labsStore';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button, CancelSaveRow } from '../../shared/ui';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ICON,
  SHORTCUT_IDS,
  SHORTCUT_LAB,
  SHORTCUT_SLOTS,
  setQuickShortcuts,
  useQuickShortcuts,
  type ShortcutId,
} from './quickShortcuts';

/** 빠른 메뉴 바로가기 편집 (사용자 요청 2026-11-02): 모든 기능·화면 중 4개를 고른 순서대로 */
export function ShortcutEditSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const saved = useQuickShortcuts((s) => s.ids);
  const labs = useLabs();
  const [draft, setDraft] = useState<ShortcutId[]>(saved);
  const [wasOpen, setWasOpen] = useState(open);
  // 열 때마다 저장된 값에서 시작
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(saved);
  }
  const toggle = (id: ShortcutId) =>
    setDraft((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < SHORTCUT_SLOTS
          ? [...cur, id]
          : cur,
    );
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('quickMenu.editTitle')}
      description={t('quickMenu.editDesc', { n: SHORTCUT_SLOTS })}
      autoFocusInput={false}
      footer={
        <CancelSaveRow onCancel={() => onOpenChange(false)}>
          <Button
            size="lg"
            fullWidth
            disabled={draft.length === 0}
            onClick={() => {
              setQuickShortcuts(draft);
              onOpenChange(false);
            }}
          >
            {t('form.save')}
          </Button>
        </CancelSaveRow>
      }
      headerAside={
        <button
          type="button"
          onClick={() => setDraft(DEFAULT_SHORTCUTS)}
          className="h-9 text-caption font-semibold text-primary"
        >
          {t('quickMenu.editReset')}
        </button>
      }
    >
      <ul className="grid grid-cols-2 gap-2 pb-2">
        {SHORTCUT_IDS.filter((id) => {
          const lab = SHORTCUT_LAB[id];
          return !lab || labs[lab] === true;
        }).map((id) => {
          const Icon = SHORTCUT_ICON[id];
          const order = draft.indexOf(id);
          const full = order < 0 && draft.length >= SHORTCUT_SLOTS;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={order >= 0}
                disabled={full}
                onClick={() => toggle(id)}
                className={`flex h-12 w-full items-center gap-2 rounded-btn border px-3 text-left text-caption font-semibold disabled:opacity-40 ${order >= 0 ? 'border-primary bg-primary-weak' : 'border-line'}`}
              >
                <Icon aria-hidden="true" className="size-[18px] shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{t(`quickMenu.shortcut.${id}`)}</span>
                {order >= 0 && (
                  <span className="tabular grid size-5 shrink-0 place-items-center rounded-full bg-primary text-micro text-on-primary">
                    {order + 1}
                  </span>
                )}
                {order < 0 && !full && (
                  <Check aria-hidden="true" className="size-4 text-transparent" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
