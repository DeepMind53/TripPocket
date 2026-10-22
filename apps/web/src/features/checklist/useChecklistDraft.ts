import type { ChecklistItem } from '@trippocket/shared';
import { useCallback, useMemo, useState } from 'react';
import { useChecklist, useSetting } from '../../data/hooks';
import type { ListKind, NewChecklistEntry } from '../../data/repositories/checklistRepo';
import { categoriesKey, saveChecklistDraft } from '../../data/services/checklistService';
import { CATEGORIES } from './templates';

/** 화면에서 고치는 한 줄. key는 화면용(새 항목도 있음), id는 저장소 id */
export interface DraftItem {
  key: string;
  id?: string | undefined;
  text: string;
  category?: string | undefined;
  checked: boolean;
}

export interface Draft {
  packing: DraftItem[];
  todo: DraftItem[];
  categories: string[];
}

const FALLBACK_CATEGORY = '기타';
const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
let tempSeq = 0;
const tempKey = () => `new-${Date.now()}-${tempSeq++}`;

function fromDb(packing: ChecklistItem[], todo: ChecklistItem[], saved: string[] | null): Draft {
  const categories = [...(saved ?? CATEGORIES)];
  const toItem = (i: ChecklistItem, withCategory: boolean): DraftItem => ({
    key: i.id,
    id: i.id,
    text: i.text,
    checked: i.checked,
    ...(withCategory ? { category: i.category ?? FALLBACK_CATEGORY } : {}),
  });
  const packingItems = packing.map((i) => toItem(i, true));
  for (const i of packingItems) {
    if (i.category && !categories.includes(i.category)) categories.push(i.category);
  }
  // 화면 순서 = 카테고리 순서대로 묶은 순서
  const ordered = categories.flatMap((c) => packingItems.filter((i) => i.category === c));
  return { packing: ordered, todo: todo.map((i) => toItem(i, false)), categories };
}

/**
 * 준비 탭 편집 초안. 바꾼 내용은 [저장] 전까지 화면에만 있고, [취소]하면 저장된 상태로 돌아간다.
 * 저장된 데이터가 바뀌어도(다른 화면·기기) 편집 중이 아닐 때만 새로 불러온다.
 */
export function useChecklistDraft(tripId: string) {
  const packing = useChecklist(tripId, 'packing');
  const todo = useChecklist(tripId, 'todo');
  const savedCategories = useSetting<string[] | null>(categoriesKey(tripId), null);
  // 저장된 상태(항상 최신)와, 편집을 시작한 뒤의 초안. 초안이 있으면 = 저장 안 한 변경이 있음
  const base = useMemo(
    () => (packing && todo ? fromDb(packing, todo, savedCategories) : null),
    [packing, todo, savedCategories],
  );
  const [edited, setEdited] = useState<Draft | null>(null);
  const draft = edited ?? base;
  const dirty = edited !== null;

  const update = useCallback(
    (fn: (d: Draft) => Draft) => {
      setEdited((e) => {
        const current = e ?? base;
        return current ? fn(current) : e;
      });
    },
    [base],
  );

  const actions = {
    add(list: ListKind, entry: NewChecklistEntry) {
      update((d) => ({
        ...d,
        [list]: insertItem(d, list, {
          key: tempKey(),
          text: entry.text.trim(),
          checked: false,
          ...(list === 'packing' ? { category: entry.category ?? FALLBACK_CATEGORY } : {}),
        }),
      }));
    },
    toggle(list: ListKind, key: string) {
      update((d) => ({
        ...d,
        [list]: d[list].map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)),
      }));
    },
    remove(list: ListKind, key: string) {
      update((d) => ({ ...d, [list]: d[list].filter((i) => i.key !== key) }));
    },
    /** @returns 추가 여부 (이미 있으면 false) */
    addCategory(name: string): boolean {
      const n = name.trim();
      if (!n || draft?.categories.some((c) => normalize(c) === normalize(n))) return false;
      update((d) => ({ ...d, categories: [...d.categories, n] }));
      return true;
    },
    /** 그룹 전체 삭제: 카테고리와 그 안의 항목 */
    removeCategory(name: string) {
      update((d) => ({
        ...d,
        categories: d.categories.filter((c) => c !== name),
        packing: d.packing.filter((i) => i.category !== name),
      }));
    },
    /** 템플릿 적용: 이미 있는 항목은 건너뛴다. @returns 추가된 개수 */
    applyTemplate(list: ListKind, entries: readonly NewChecklistEntry[]): number {
      if (!draft) return 0;
      const seen = new Set(draft[list].map((i) => normalize(i.text)));
      const fresh = entries.filter((e) => {
        const k = normalize(e.text);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (fresh.length === 0) return 0;
      update((d) => {
        let next = d;
        for (const e of fresh) {
          const category = list === 'packing' ? (e.category ?? FALLBACK_CATEGORY) : undefined;
          const categories =
            category && !next.categories.includes(category)
              ? [...next.categories, category]
              : next.categories;
          next = { ...next, categories };
          next = {
            ...next,
            [list]: insertItem(next, list, {
              key: tempKey(),
              text: e.text,
              checked: false,
              ...(category ? { category } : {}),
            }),
          };
        }
        return next;
      });
      return fresh.length;
    },
    /** 드래그 결과로 목록 전체를 바꾼다 */
    reorder(list: ListKind, items: DraftItem[]) {
      update((d) => ({ ...d, [list]: items }));
    },
  };

  async function save() {
    if (!draft) return;
    const strip = (items: DraftItem[]) => items.map(({ key: _k, ...rest }) => rest);
    await saveChecklistDraft(tripId, {
      packing: strip(draft.packing),
      todo: strip(draft.todo),
      categories: draft.categories,
    });
    setEdited(null);
  }

  const cancel = () => setEdited(null);

  return { draft, dirty, actions, save, cancel };
}

/** 같은 카테고리의 맨 뒤에 넣는다 (화면 순서 유지) */
function insertItem(d: Draft, list: ListKind, item: DraftItem): DraftItem[] {
  const items = d[list];
  if (list !== 'packing') return [...items, item];
  const lastIndex = items.map((i) => i.category).lastIndexOf(item.category);
  if (lastIndex >= 0)
    return [...items.slice(0, lastIndex + 1), item, ...items.slice(lastIndex + 1)];
  // 새 카테고리면 카테고리 순서에 맞는 자리로
  const order = d.categories;
  const pos = order.indexOf(item.category ?? '');
  const after = items.findIndex((i) => order.indexOf(i.category ?? '') > pos);
  return after < 0 ? [...items, item] : [...items.slice(0, after), item, ...items.slice(after)];
}
