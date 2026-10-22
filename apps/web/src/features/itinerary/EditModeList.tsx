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
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ItineraryItem, LocalDate } from '@trippocket/shared';
import { GripVertical } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { itemRepo } from '../../data/repositories/itemRepo';
import { cn } from '../../shared/lib/cn';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { KIND_ICON } from './itemKinds';

/** 컨테이너 id: 날짜 또는 'wish' */
const WISH = 'wish';
const containerOf = (date: LocalDate | null) => date ?? WISH;
const dateOf = (container: string): LocalDate | null => (container === WISH ? null : container);

type Columns = Record<string, string[]>;

export interface EditModeListProps {
  /** 보여줄 날 (null = 가고 싶은 곳) — 현재 Day 칩 필터를 따른다 */
  sections: Array<{ date: LocalDate | null; index: number; color: string }>;
  items: ItineraryItem[];
}

function buildColumns(sections: EditModeListProps['sections'], items: ItineraryItem[]): Columns {
  const cols: Columns = {};
  for (const s of sections) cols[containerOf(s.date)] = [];
  for (const it of items) cols[containerOf(it.date)]?.push(it.id);
  return cols;
}

/**
 * S-13 편집 모드: 손잡이(⠿)를 끌어 같은 날·다른 날로 옮긴다 (dnd-kit).
 * 이 화면은 편집 모드에 들어갈 때만 불러온다 (번들 크기).
 * 놓는 순간 옮긴 일정 하나만 저장한다 (itemRepo.move).
 */
export default function EditModeList({ sections, items }: EditModeListProps) {
  const { t } = useTranslation();
  const [columns, setColumns] = useState<Columns>(() => buildColumns(sections, items));
  const dragging = useRef(false);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // 드래그 중이 아닐 때만 저장소 변경을 반영한다 (끄는 도중 목록이 튀지 않게)
  useEffect(() => {
    if (!dragging.current) setColumns(buildColumns(sections, items));
  }, [sections, items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id: UniqueIdentifier): string | undefined => {
    const key = String(id);
    if (key in columns) return key;
    return Object.keys(columns).find((c) => columns[c]?.includes(key));
  };

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;
    // 다른 날 위로 지나가면 그 날 목록으로 옮겨 보여준다
    setColumns((prev) => {
      const source = (prev[from] ?? []).filter((id) => id !== active.id);
      const target = [...(prev[to] ?? [])];
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, String(active.id));
      return { ...prev, [from]: source, [to]: target };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    dragging.current = false;
    const container = findContainer(active.id);
    if (!over || !container) {
      setColumns(buildColumns(sections, items));
      return;
    }
    let column = columns[container] ?? [];
    const overIndex = column.indexOf(String(over.id));
    const activeIndex = column.indexOf(String(active.id));
    if (overIndex >= 0 && overIndex !== activeIndex) {
      column = arrayMove(column, activeIndex, overIndex);
      setColumns((prev) => ({ ...prev, [container]: column }));
    }
    const item = byId.get(String(active.id));
    const index = column.indexOf(String(active.id));
    const date = dateOf(container);
    const original = item
      ? (buildColumns(sections, items)[containerOf(item.date)] ?? []).indexOf(item.id)
      : -1;
    if (item && (item.date !== date || original !== index)) {
      void itemRepo.move(item.id, date, index);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={() => {
        dragging.current = true;
        navigator.vibrate?.(10);
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        dragging.current = false;
        setColumns(buildColumns(sections, items));
      }}
      accessibility={{
        screenReaderInstructions: { draggable: t('edit.srInstructions') },
        announcements: {
          onDragStart: ({ active }) =>
            t('edit.srPicked', { title: byId.get(String(active.id))?.title ?? '' }),
          onDragOver: () => undefined,
          onDragEnd: ({ active }) =>
            t('edit.srDropped', { title: byId.get(String(active.id))?.title ?? '' }),
          onDragCancel: () => t('edit.srCancelled'),
        },
      }}
    >
      <div className="flex flex-col gap-6">
        {sections.map((s) => {
          const id = containerOf(s.date);
          const title = s.date
            ? t('plan.dayHeader', { n: s.index + 1, date: formatMonthDay(s.date) })
            : t('plan.wishlist');
          return (
            <DayColumn key={id} id={id} title={title} empty={(columns[id] ?? []).length === 0}>
              <SortableContext items={columns[id] ?? []} strategy={verticalListSortingStrategy}>
                {(columns[id] ?? []).map((itemId, i) => {
                  const item = byId.get(itemId);
                  return item ? (
                    <SortableRow key={itemId} item={item} n={i + 1} color={s.color} />
                  ) : null;
                })}
              </SortableContext>
            </DayColumn>
          );
        })}
      </div>
    </DndContext>
  );
}

function DayColumn({
  id,
  title,
  empty,
  children,
}: {
  id: string;
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  // 빈 날에도 놓을 수 있게 날 전체를 놓는 자리로
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h2 className="tabular text-title-2">{title}</h2>
      <ol
        ref={setNodeRef}
        className={cn(
          'flex min-h-14 flex-col gap-1 rounded-card p-1 transition-colors',
          isOver ? 'bg-primary-weak' : 'bg-bg-subtle',
        )}
      >
        {children}
        {empty && (
          <li aria-hidden="true" className="px-3 py-3 text-caption text-fg-muted">
            {t('edit.dropHere')}
          </li>
        )}
      </ol>
    </section>
  );
}

function SortableRow({ item, n, color }: { item: ItineraryItem; n: number; color: string }) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const Icon = KIND_ICON[item.kind];
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-btn bg-surface py-1.5 pr-3 pl-1 shadow-card',
        isDragging && 'relative z-10 scale-[1.02] shadow-lg',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t('edit.handle', { title: item.title })}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-fg-muted active:cursor-grabbing"
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>
      <span
        aria-hidden="true"
        className="tabular grid size-6 shrink-0 place-items-center rounded-full text-micro text-white"
        style={{ background: color }}
      >
        {n}
      </span>
      <span className="tabular w-11 shrink-0 text-caption text-fg-sub">
        {item.startTime ?? '—'}
      </span>
      <span className="min-w-0 flex-1 truncate text-body-2 font-medium">{item.title}</span>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
    </li>
  );
}
