import type { ChecklistTemplate } from '@trippocket/shared';
import { useTrip } from '../../data/hooks';
import { useEssentials } from '../essentials/useEssentials';
import { Check, ListPlus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useBeforeUnload, useBlocker, useParams } from 'react-router';
import { useCanEdit } from '../../data/tripRoles';
import type { PrepList as ListKind } from '../../data/repositories/checklistRepo';
import { useTranslation } from '../../i18n';
import { useBottomInset } from '../../shared/hooks/useBottomInset';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import {
  BottomSheet,
  Button,
  Chip,
  IconButton,
  SegmentedControl,
  toast,
  Skeleton,
  ScrollRow,
  confirmDelete,
} from '../../shared/ui';
import { ChecklistBoard } from './ChecklistBoard';
import { TemplateSheet } from './TemplateSheet';
import { useChecklistDraft, type Draft } from './useChecklistDraft';

/**
 * S-18 준비: 준비물 / 할 일.
 * 바꾼 내용은 바로 저장되지 않고 하단 [저장]·[취소]로 확정한다 (사용자 요청 2026-10-22).
 */
export function ChecklistPage() {
  const { t } = useTranslation();
  const { tripId = '' } = useParams();
  const [list, setList] = useState<ListKind>('packing');
  const { draft, dirty, actions, save, cancel } = useChecklistDraft(tripId);
  // 보기 전용으로 공유받은 여행: 보기만 (data/tripRoles.ts)
  const canEdit = useCanEdit(tripId);
  const [templateOpen, setTemplateOpen] = useRouteSheet('checklist-template');
  const [saving, setSaving] = useState(false);
  // 해외 여행이면 맨 위에 나라별 필수 항목 바로가기 (docs/19)
  const essentials = useEssentials(useTrip(tripId) ?? undefined);

  // 저장하지 않고 다른 화면으로 가려 하면 묻는다 (같은 화면의 시트 열기는 제외)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useBeforeUnload((e) => {
    if (dirty) e.preventDefault();
  });

  if (!draft) return <Skeleton rows={2} />;
  const items = draft[list];
  const done = items.filter((i) => i.checked).length;
  const total = items.length;

  async function doSave() {
    setSaving(true);
    try {
      await save();
      toast(t('checklist.saved'));
    } catch {
      toast(t('form.failed'));
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(tpl: ChecklistTemplate) {
    const added = actions.applyTemplate(list, tpl.items);
    setTemplateOpen(false);
    toast(added > 0 ? t('checklist.templateAdded', { n: added }) : t('checklist.templateNoNew'));
  }

  return (
    <div className={`flex flex-col gap-4 px-5 pt-3 ${dirty ? 'pb-24' : ''}`}>
      {essentials && essentials.total > 0 && (
        <Link
          to={`/trips/${tripId}/essentials`}
          className="tabular flex items-center justify-between gap-2 rounded-card border border-dashed border-primary/60 px-4 py-3 text-body-2 font-semibold"
        >
          <span>🛂 {t('essentials.title')}</span>
          <span className="text-primary">
            {essentials.done}/{essentials.total} ›
          </span>
        </Link>
      )}
      {canEdit && (
        <Button
          variant="secondary"
          fullWidth
          leading={<ListPlus aria-hidden="true" className="size-4" />}
          onClick={() => setTemplateOpen(true)}
        >
          {t('checklist.template')}
        </Button>
      )}

      <SegmentedControl
        label={t('checklist.listLabel')}
        value={list}
        onChange={setList}
        options={[
          { value: 'packing', label: t('checklist.packing') },
          { value: 'todo', label: t('checklist.todo') },
        ]}
      />

      {total > 0 && <Progress done={done} total={total} list={list} />}

      {canEdit && <AddRow key={list} list={list} draft={draft} actions={actions} />}

      {total === 0 && list === 'todo' && (
        <p className="py-6 text-center text-body-2 text-fg-muted">{t('checklist.emptyTodo')}</p>
      )}

      <ChecklistBoard
        items={items}
        categories={list === 'packing' ? draft.categories : undefined}
        onToggle={(key) => actions.toggle(list, key)}
        onRemove={(key) => {
          const name = items.find((i) => i.key === key)?.text ?? '';
          void confirmDelete(t('confirm.checklist', { name })).then(
            (ok) => ok && actions.remove(list, key),
          );
        }}
        readOnly={!canEdit}
        onRemoveGroup={
          canEdit
            ? (name) =>
                void confirmDelete(t('confirm.group', { name })).then((ok) => {
                  if (!ok) return;
                  actions.removeCategory(name);
                  toast(t('checklist.groupDeleted', { name }));
                })
            : undefined
        }
        onReorder={(next) => actions.reorder(list, next)}
      />

      {dirty && <SaveBar saving={saving} onSave={() => void doSave()} onCancel={cancel} />}

      <TemplateSheet
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        list={list}
        current={items.map((i) => ({ text: i.text, category: i.category }))}
        onApply={applyTemplate}
      />

      <BottomSheet
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('checklist.unsavedTitle')}
        description={t('checklist.unsavedDesc')}
      >
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            fullWidth
            onClick={() =>
              void save().then(() => {
                if (blocker.state === 'blocked') blocker.proceed();
              })
            }
          >
            {t('checklist.saveAndLeave')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            className="text-danger"
            onClick={() => {
              cancel();
              if (blocker.state === 'blocked') blocker.proceed();
            }}
          >
            {t('checklist.leaveWithoutSave')}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => blocker.state === 'blocked' && blocker.reset()}
          >
            {t('checklist.keepEditing')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function Progress({ done, total, list }: { done: number; total: number; list: ListKind }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex justify-between text-caption font-semibold">
        <span>
          {done === total
            ? t('checklist.allDone')
            : t(list === 'packing' ? 'checklist.progress' : 'checklist.progressTodo', {
                done,
                total,
              })}
        </span>
        <span className="tabular text-fg-muted">{Math.round((done / total) * 100)}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={t('checklist.progress', { done, total })}
        className="h-2 overflow-hidden rounded-full bg-bg-subtle"
      >
        <div
          className="h-full rounded-full bg-success transition-[width] duration-300"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function AddRow({
  list,
  draft,
  actions,
}: {
  list: ListKind;
  draft: Draft;
  actions: ReturnType<typeof useChecklistDraft>['actions'];
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<string>(draft.categories[0] ?? '기타');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  // 고른 카테고리를 그룹 삭제로 지웠으면 첫 카테고리로
  const selectedCategory = draft.categories.includes(category)
    ? category
    : (draft.categories[0] ?? '기타');

  function add() {
    if (!text.trim()) {
      toast(t('checklist.needText'));
      return;
    }
    actions.add(list, { text, ...(list === 'packing' ? { category: selectedCategory } : {}) });
    setText('');
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    if (!actions.addCategory(name)) {
      toast(t('checklist.categoryExists'));
      return;
    }
    setCategory(name);
    setNewCategory('');
    setAddingCategory(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          id="checklist-new"
          aria-label={
            list === 'packing' ? t('checklist.addPlaceholder') : t('checklist.addTodoPlaceholder')
          }
          placeholder={
            list === 'packing' ? t('checklist.addPlaceholder') : t('checklist.addTodoPlaceholder')
          }
          value={text}
          maxLength={100}
          onChange={(e) => setText(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary"
        />
        <Button type="submit" leading={<Plus aria-hidden="true" className="size-4" />}>
          {t('checklist.add')}
        </Button>
      </form>
      {list === 'packing' && (
        <ScrollRow
          role="radiogroup"
          aria-label={t('checklist.category')}
          className="flex items-center gap-1.5 pt-1.5 pb-1"
        >
          {draft.categories.map((c) => (
            <Chip
              key={c}
              role="radio"
              aria-checked={c === selectedCategory}
              selected={c === selectedCategory}
              onClick={() => setCategory(c)}
            >
              {c}
            </Chip>
          ))}
          {addingCategory ? (
            <form
              className="flex shrink-0 items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                addCategory();
              }}
            >
              <input
                id="checklist-new-category"
                aria-label={t('checklist.categoryPlaceholder')}
                placeholder={t('checklist.categoryPlaceholder')}
                value={newCategory}
                maxLength={30}
                autoFocus
                onChange={(e) => setNewCategory(e.target.value)}
                className="h-[34px] w-28 rounded-full border border-primary bg-surface px-3 text-caption outline-none"
              />
              <IconButton
                type="submit"
                label={t('checklist.categoryAdd')}
                icon={<Check />}
                tone="tint"
              />
              <IconButton
                label={t('checklist.cancel')}
                icon={<X />}
                onClick={() => setAddingCategory(false)}
              />
            </form>
          ) : (
            <Chip
              aria-label={t('checklist.categoryAdd')}
              onClick={() => setAddingCategory(true)}
              className="border-dashed"
            >
              <Plus aria-hidden="true" className="size-4" />
            </Chip>
          )}
        </ScrollRow>
      )}
    </div>
  );
}

/** 하단 플로팅 [취소] [저장] — 바꾼 내용이 있을 때만 (탭바 바로 위, 위치 고정) */
function SaveBar({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  // 토스트가 저장 버튼 줄 위에 뜨도록
  useBottomInset(56 + 72);
  return (
    <div
      role="region"
      aria-label={t('checklist.unsavedBar')}
      className="fixed inset-x-0 z-30 mx-auto flex w-full max-w-[560px] gap-2 px-4"
      style={{ bottom: 'calc(56px + env(safe-area-inset-bottom) + 12px)' }}
    >
      <Button
        variant="secondary"
        size="lg"
        className="flex-1 shadow-card"
        onClick={onCancel}
        disabled={saving}
      >
        {t('checklist.cancel')}
      </Button>
      <Button size="lg" className="flex-[2] shadow-card" loading={saving} onClick={onSave}>
        {t('checklist.save')}
      </Button>
    </div>
  );
}
