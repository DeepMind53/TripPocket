import {
  ChecklistItemSchema,
  compareKeys,
  keyBetween,
  keysBetween,
  uuidv7,
  type ChecklistItem,
} from '@trippocket/shared';
import { nowIso } from '../clock';
import { useAuth } from '../authStore';
import { db, toDomain } from '../db';

export type ListKind = ChecklistItem['list'];
/** 준비 탭 목록 (준비물·할 일) — essentials(나라별 필수 항목)는 따로 화면 */
export type PrepList = Exclude<ListKind, 'essentials'>;
export interface NewChecklistEntry {
  text: string;
  category?: string | undefined;
}

/** 편집 화면의 한 줄 (id가 없으면 새 항목) */
export interface DraftEntry extends NewChecklistEntry {
  id?: string | undefined;
  checked: boolean;
}

const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 내 것인가: 만든 사람이 없으면(이 기기에서 만듦·예전 행) 내 것 (2026-10-27 개인별 준비 목록) */
const mine = (r: { ownerId?: string | undefined }) => {
  const me = useAuth.getState().me?.id;
  return !r.ownerId || !me || r.ownerId === me;
};

async function listRows(tripId: string, list: ListKind) {
  const rows = await db.checklistItems
    .where('[tripId+list]')
    .equals([tripId, list])
    .filter((r) => !r.deletedAt && mine(r))
    .toArray();
  return rows.sort((a, b) => compareKeys(a.order, b.order) || compareKeys(a.id, b.id));
}

export const checklistRepo = {
  async list(tripId: string, list: ListKind): Promise<ChecklistItem[]> {
    return (await listRows(tripId, list)).map(toDomain);
  },

  /** 일행이 공유한 준비물 (읽기 전용) */
  async listShared(tripId: string): Promise<ChecklistItem[]> {
    const rows = await db.checklistItems
      .where('[tripId+list]')
      .equals([tripId, 'packing'])
      .filter((r) => !r.deletedAt && !mine(r) && r.shared === true)
      .toArray();
    return rows.sort((a, b) => compareKeys(a.order, b.order)).map(toDomain);
  },

  /**
   * 내 준비물 중 공유할 것 정하기: ids에 있는 것만 공유, 나머지는 공유 끔. 바뀐 행만 고친다
   * (처음 공유하면 sharedAt을 남긴다 — 끈 것도 일행 기기에 내려가 숨겨지도록)
   */
  async setShared(tripId: string, ids: ReadonlySet<string>): Promise<number> {
    return db.transaction('rw', db.checklistItems, async () => {
      const now = nowIso();
      let changed = 0;
      for (const r of await listRows(tripId, 'packing')) {
        const on = ids.has(r.id);
        if ((r.shared === true) === on) continue;
        changed++;
        await db.checklistItems.update(r.id, {
          shared: on,
          ...(on && !r.sharedAt ? { sharedAt: now } : {}),
          updatedAt: now,
          dirty: 1,
        });
      }
      return changed;
    });
  },

  /** 맨 뒤에 추가 */
  async add(tripId: string, list: ListKind, entry: NewChecklistEntry): Promise<ChecklistItem> {
    return db.transaction('rw', db.checklistItems, async () => {
      const last = (await listRows(tripId, list)).at(-1)?.order ?? null;
      const now = nowIso();
      const item = ChecklistItemSchema.parse({
        id: uuidv7(),
        tripId,
        list,
        text: entry.text,
        ...(entry.category ? { category: entry.category } : {}),
        checked: false,
        order: keyBetween(last, null),
        createdAt: now,
        updatedAt: now,
      });
      await db.checklistItems.add({ ...item, dirty: 1 });
      return item;
    });
  },

  /**
   * 템플릿 등 여러 개를 한 번에 추가. 이미 있는 항목(공백·대소문자 무시 같은 글)은 건너뛴다.
   * @returns 실제로 추가된 개수
   */
  async addMany(
    tripId: string,
    list: ListKind,
    entries: readonly NewChecklistEntry[],
  ): Promise<number> {
    return db.transaction('rw', db.checklistItems, async () => {
      const rows = await listRows(tripId, list);
      const seen = new Set(rows.map((r) => normalize(r.text)));
      const fresh = entries.filter((e) => {
        const key = normalize(e.text);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const keys = keysBetween(rows.at(-1)?.order ?? null, null, fresh.length);
      const now = nowIso();
      await db.checklistItems.bulkAdd(
        fresh.map((e, i) => ({
          ...ChecklistItemSchema.parse({
            id: uuidv7(),
            tripId,
            list,
            text: e.text,
            ...(e.category ? { category: e.category } : {}),
            checked: false,
            order: keys[i],
            createdAt: now,
            updatedAt: now,
          }),
          dirty: 1 as const,
        })),
      );
      return fresh.length;
    });
  },

  /**
   * 편집 화면의 [저장]: 화면에서 고친 목록 전체를 한 번에 반영한다 (전부 저장되거나 전부 취소).
   * - id가 있으면 수정, 없으면 새로 추가, 목록에서 빠진 기존 항목은 휴지통으로
   * - 순서는 화면 순서대로 다시 매긴다
   */
  async applyDraft(tripId: string, list: ListKind, draft: readonly DraftEntry[]): Promise<void> {
    await db.transaction('rw', db.checklistItems, async () => {
      const rows = await listRows(tripId, list);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const keys = keysBetween(null, null, draft.length);
      const now = nowIso();
      const kept = new Set<string>();
      const puts = draft.map((d, i) => {
        const prev = d.id ? byId.get(d.id) : undefined;
        if (prev) kept.add(prev.id);
        const { category: _c, ...base } = prev ? toDomain(prev) : ({} as Partial<ChecklistItem>);
        return {
          ...ChecklistItemSchema.parse({
            ...base,
            id: prev?.id ?? uuidv7(),
            tripId,
            list,
            text: d.text,
            ...(d.category ? { category: d.category } : {}),
            checked: d.checked,
            order: keys[i],
            createdAt: prev?.createdAt ?? now,
            updatedAt: now,
          }),
          dirty: 1 as const,
        };
      });
      await db.checklistItems.bulkPut(puts);
      const removed = rows.filter((r) => !kept.has(r.id));
      for (const r of removed) {
        await db.checklistItems.update(r.id, { deletedAt: now, updatedAt: now, dirty: 1 });
      }
    });
  },

  /** 나라별 필수 항목 체크 (docs/19): 키("JP:arrival")로 찾아 켜고 끄기, 없으면 만든다 */
  async setEssential(tripId: string, key: string, checked: boolean): Promise<void> {
    const existing = (await listRows(tripId, 'essentials')).find((r) => r.text === key);
    if (existing) return this.setChecked(existing.id, checked);
    if (!checked) return;
    const item = await this.add(tripId, 'essentials', { text: key });
    await this.setChecked(item.id, true);
  },

  async setChecked(id: string, checked: boolean): Promise<void> {
    await db.checklistItems.update(id, { checked, updatedAt: nowIso(), dirty: 1 });
  },

  async softDelete(id: string): Promise<void> {
    const now = nowIso();
    await db.checklistItems.update(id, { deletedAt: now, updatedAt: now, dirty: 1 });
  },

  async restore(id: string): Promise<void> {
    await db.checklistItems.update(id, { deletedAt: undefined, updatedAt: nowIso(), dirty: 1 });
  },
};
