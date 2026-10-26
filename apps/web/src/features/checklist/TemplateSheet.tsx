import type { ChecklistTemplate } from '@trippocket/shared';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTemplates } from '../../data/hooks';
import type {
  PrepList as ListKind,
  NewChecklistEntry,
} from '../../data/repositories/checklistRepo';
import { templateRepo } from '../../data/repositories/templateRepo';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button, IconButton, snackbar, toast } from '../../shared/ui';
import { TEMPLATE_SEEDS } from './templates';
import { confirmDelete } from '../../shared/ui';

export interface TemplateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: ListKind;
  /** 지금 화면의 목록 (새 템플릿으로 저장할 때) */
  current: readonly NewChecklistEntry[];
  onApply: (template: ChecklistTemplate) => void;
}

const inputClass =
  'h-11 min-w-0 flex-1 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary';

/**
 * 템플릿 불러오기 + 관리 (이름 수정·추가·삭제). 템플릿 변경은 여행 목록과 별개라 바로 저장된다.
 * 기본 템플릿은 처음 열 때 한 번 복사된다.
 */
export function TemplateSheet({ open, onOpenChange, list, current, onApply }: TemplateSheetProps) {
  const { t } = useTranslation();
  const templates = useTemplates(list);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (open) void templateRepo.seedOnce(TEMPLATE_SEEDS);
  }, [open]);

  async function rename(id: string) {
    if (!editName.trim()) {
      toast(t('checklist.templateNeedName'));
      return;
    }
    await templateRepo.rename(id, editName);
    setEditingId(null);
  }

  async function remove(tpl: ChecklistTemplate) {
    if (!(await confirmDelete(t('confirm.item', { name: tpl.name })))) return;
    await templateRepo.softDelete(tpl.id);
    snackbar(t('checklist.templateDeleted'), {
      label: t('common.undo'),
      onAction: () => void templateRepo.restore(tpl.id),
    });
  }

  async function saveCurrent() {
    if (!newName.trim()) {
      toast(t('checklist.templateNeedName'));
      return;
    }
    if (current.length === 0) {
      toast(t('checklist.templateNeedItems'));
      return;
    }
    await templateRepo.create(list, newName, current);
    setNewName('');
    toast(t('checklist.templateSaved'));
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('checklist.templateTitle')}>
      <div className="flex flex-col gap-4">
        {templates?.length === 0 && (
          <p className="py-2 text-body-2 text-fg-muted">{t('checklist.templateEmpty')}</p>
        )}
        <ul className="flex flex-col divide-y divide-line">
          {templates?.map((tpl) => (
            <li key={tpl.id} className="flex min-h-14 items-center gap-1">
              {editingId === tpl.id ? (
                <form
                  className="flex flex-1 items-center gap-1 py-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rename(tpl.id);
                  }}
                >
                  <input
                    id={`tpl-name-${tpl.id}`}
                    aria-label={t('checklist.templateNamePlaceholder')}
                    value={editName}
                    maxLength={40}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputClass}
                  />
                  <IconButton
                    type="submit"
                    label={t('checklist.save')}
                    icon={<Check />}
                    tone="tint"
                  />
                  <IconButton
                    label={t('checklist.cancel')}
                    icon={<X />}
                    onClick={() => setEditingId(null)}
                  />
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onApply(tpl)}
                    aria-label={t('checklist.applyTemplate', { name: tpl.name })}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-body-1">{tpl.name}</span>
                    <span className="tabular shrink-0 text-caption text-fg-muted">
                      {t('checklist.templateCount', { n: tpl.items.length })}
                    </span>
                  </button>
                  <IconButton
                    label={t('checklist.templateRename', { name: tpl.name })}
                    icon={<Pencil />}
                    onClick={() => {
                      setEditingId(tpl.id);
                      setEditName(tpl.name);
                    }}
                  />
                  <IconButton
                    label={t('checklist.templateDelete', { name: tpl.name })}
                    icon={<Trash2 />}
                    onClick={() => void remove(tpl)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>

        <form
          className="flex flex-col gap-2 rounded-card bg-bg-subtle p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void saveCurrent();
          }}
        >
          <span className="text-caption font-semibold text-fg-sub">
            {t('checklist.saveAsTemplate')}
          </span>
          <div className="flex gap-2">
            <input
              id="tpl-new-name"
              aria-label={t('checklist.templateNamePlaceholder')}
              placeholder={t('checklist.templateNamePlaceholder')}
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
              className={`${inputClass} bg-surface`}
            />
            <Button type="submit" leading={<Plus aria-hidden="true" className="size-4" />}>
              {t('checklist.add')}
            </Button>
          </div>
          <span className="text-caption text-fg-muted">
            {t('checklist.saveAsTemplateDesc', { n: current.length })}
          </span>
        </form>
      </div>
    </BottomSheet>
  );
}
