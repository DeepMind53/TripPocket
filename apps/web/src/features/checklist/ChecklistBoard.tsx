import { haptic } from '../../data/settingsStore';
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, ChevronDown, GripVertical, Trash2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import type { DraftItem } from './useChecklistDraft';

const GROUP = 'group:';
const SINGLE = 'single';

export interface ChecklistBoardProps {
  items: DraftItem[];
  /** 준비물: 카테고리 순서. 할 일: undefined (묶음 없이 한 줄) */
  categories?: string[] | undefined;
  onToggle: (key: string) => void;
  onRemove: (key: string) => void;
  onRemoveGroup?: ((name: string) => void) | undefined;
  /** 드래그 결과 (카테고리가 바뀐 항목 포함) 전체 목록 */
  onReorder: (items: DraftItem[]) => void;
}

/**
 * 준비물·할 일 목록. 손잡이(⠿)를 끌어 같은 그룹 안 순서를 바꾸거나 다른 그룹으로 옮긴다.
 * 결과는 초안에만 반영되고 [저장]해야 저장된다.
 */
export function ChecklistBoard({
  items,
  categories,
  onToggle,
  onRemove,
  onRemoveGroup,
  onReorder,
}: ChecklistBoardProps) {
  const { t } = useTranslation();
  const grouped = categories !== undefined;
  const containers = grouped ? categories.map((c) => GROUP + c) : [SINGLE];
  const itemsOf = (container: string) =>
    container === SINGLE ? items : items.filter((i) => GROUP + (i.category ?? '') === container);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containerOf = (id: string) =>
    containers.includes(id)
      ? id
      : grouped
        ? GROUP + (items.find((i) => i.key === id)?.category ?? '')
        : SINGLE;

  /** 그룹 순서대로 다시 이어 붙인다 */
  const flatten = (list: DraftItem[]) =>
    grouped ? categories.flatMap((c) => list.filter((i) => i.category === c)) : list;

  function onDragOver({ active, over }: DragOverEvent) {
    if (!grouped || !over) return;
    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (from === to) return;
    // 다른 그룹 위로 지나가면 그 그룹으로 옮겨 보여준다
    const category = to.slice(GROUP.length);
    const moved = items.map((i) => (i.key === active.id ? { ...i, category } : i));
    const without = moved.filter((i) => i.key !== active.id);
    const target = moved.find((i) => i.key === active.id) as DraftItem;
    const overIndex = without.findIndex((i) => i.key === over.id);
    const next =
      overIndex >= 0
        ? [...without.slice(0, overIndex), target, ...without.slice(overIndex)]
        : [...without, target];
    onReorder(flatten(next));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.key === active.id);
    const to = items.findIndex((i) => i.key === over.id);
    if (from < 0 || to < 0) return;
    if (grouped && items[from]?.category !== items[to]?.category) return;
    onReorder(flatten(arrayMove(items, from, to)));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={() => haptic()}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t('edit.srInstructions') },
        announcements: {
          onDragStart: ({ active }) =>
            t('edit.srPicked', { title: items.find((i) => i.key === active.id)?.text ?? '' }),
          onDragOver: () => undefined,
          onDragEnd: ({ active }) =>
            t('edit.srDropped', { title: items.find((i) => i.key === active.id)?.text ?? '' }),
          onDragCancel: () => t('edit.srCancelled'),
        },
      }}
    >
      <div className="flex flex-col gap-2">
        {containers.map((id) => {
          const list = itemsOf(id);
          const name = id === SINGLE ? '' : id.slice(GROUP.length);
          const body = (
            <SortableContext items={list.map((i) => i.key)} strategy={verticalListSortingStrategy}>
              <DropList id={id} empty={list.length === 0}>
                {list.map((i) => (
                  <Row
                    key={i.key}
                    item={i}
                    onToggle={() => onToggle(i.key)}
                    onRemove={() => onRemove(i.key)}
                  />
                ))}
              </DropList>
            </SortableContext>
          );
          if (!grouped) return <div key={id}>{body}</div>;
          const done = list.filter((i) => i.checked).length;
          return (
            <details key={id} open className="group rounded-card border border-line bg-surface">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 pr-1 pl-4">
                <span className="min-w-0 flex-1 truncate text-body-1">{name}</span>
                <span
                  className={cn(
                    'tabular shrink-0 text-caption',
                    list.length > 0 && done === list.length ? 'text-success' : 'text-fg-muted',
                  )}
                >
                  {done}/{list.length}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-fg-muted transition-transform group-open:rotate-180"
                />
                <button
                  type="button"
                  aria-label={t('checklist.groupDelete', { name })}
                  onClick={(e) => {
                    e.preventDefault();
                    onRemoveGroup?.(name);
                  }}
                  className="grid size-11 shrink-0 place-items-center text-fg-muted"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </summary>
              <div className="border-t border-line px-1 py-1">{body}</div>
            </details>
          );
        })}
      </div>
    </DndContext>
  );
}

function DropList({ id, empty, children }: { id: string; empty: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  // 빈 그룹에도 끌어 놓을 수 있게 그룹 전체를 놓는 자리로
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <ul
      ref={setNodeRef}
      className={cn('flex min-h-11 flex-col rounded-btn', isOver && 'bg-primary-weak')}
    >
      {children}
      {empty && <li className="px-3 py-3 text-caption text-fg-muted">{t('edit.dropHere')}</li>}
    </ul>
  );
}

function Row({
  item,
  onToggle,
  onRemove,
}: {
  item: DraftItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center bg-surface',
        isDragging && 'relative z-10 rounded-btn shadow-lg',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t('checklist.dragHandle', { text: item.text })}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-fg-muted active:cursor-grabbing"
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={() => {
          haptic();
          onToggle();
        }}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-btn pr-2 text-left active:bg-bg-subtle"
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-md border-2',
            item.checked ? 'border-success bg-success text-white' : 'border-line',
          )}
        >
          {item.checked && <Check className="size-4" />}
        </span>
        <span
          className={cn(
            'min-w-0 break-words text-body-2',
            item.checked && 'text-fg-muted line-through',
          )}
        >
          {item.text}
        </span>
      </button>
      <button
        type="button"
        aria-label={t('checklist.delete', { text: item.text })}
        onClick={onRemove}
        className="grid size-11 shrink-0 place-items-center text-fg-muted"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}
