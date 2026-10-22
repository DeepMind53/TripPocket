import {
  ChecklistTemplateSchema,
  compareKeys,
  keyBetween,
  keysBetween,
  uuidv7,
  type ChecklistTemplate,
} from '@trippocket/shared';
import { nowIso } from '../clock';
import { db, toDomain } from '../db';
import { settingsRepo } from './settingsRepo';
import type { ListKind, NewChecklistEntry } from './checklistRepo';

export interface TemplateSeed {
  list: ListKind;
  name: string;
  items: NewChecklistEntry[];
}

const SEEDED_KEY = 'checklistTemplatesSeeded';

export const templateRepo = {
  /**
   * 기본 템플릿을 처음 한 번만 복사해 둔다 (그 뒤로는 사용자가 이름 수정·삭제 가능).
   * 지운 기본 템플릿이 다시 생기지 않도록 "복사했음" 표시를 남긴다.
   */
  async seedOnce(seeds: readonly TemplateSeed[]): Promise<void> {
    await db.transaction('rw', db.checklistTemplates, db.settings, async () => {
      if (await settingsRepo.get(SEEDED_KEY, false)) return;
      const keys = keysBetween(null, null, seeds.length);
      const now = nowIso();
      await db.checklistTemplates.bulkAdd(
        seeds.map((seed, i) => ({
          ...ChecklistTemplateSchema.parse({
            id: uuidv7(),
            list: seed.list,
            name: seed.name,
            items: seed.items,
            order: keys[i],
            createdAt: now,
            updatedAt: now,
          }),
          dirty: 1 as const,
        })),
      );
      await settingsRepo.set(SEEDED_KEY, true);
    });
  },

  async list(list: ListKind): Promise<ChecklistTemplate[]> {
    const rows = await db.checklistTemplates
      .where('list')
      .equals(list)
      .filter((r) => !r.deletedAt)
      .toArray();
    return rows.sort((a, b) => compareKeys(a.order, b.order)).map(toDomain);
  },

  /** 맨 뒤에 새 템플릿 */
  async create(
    list: ListKind,
    name: string,
    items: readonly NewChecklistEntry[],
  ): Promise<ChecklistTemplate> {
    return db.transaction('rw', db.checklistTemplates, async () => {
      const last = (await templateRepo.list(list)).at(-1)?.order ?? null;
      const now = nowIso();
      const tpl = ChecklistTemplateSchema.parse({
        id: uuidv7(),
        list,
        name,
        items: items.map((i) => ({
          text: i.text,
          ...(i.category ? { category: i.category } : {}),
        })),
        order: keyBetween(last, null),
        createdAt: now,
        updatedAt: now,
      });
      await db.checklistTemplates.add({ ...tpl, dirty: 1 });
      return tpl;
    });
  },

  async rename(id: string, name: string): Promise<void> {
    await db.transaction('rw', db.checklistTemplates, async () => {
      const row = await db.checklistTemplates.get(id);
      if (!row || row.deletedAt) throw new Error('템플릿을 찾을 수 없어요');
      const tpl = ChecklistTemplateSchema.parse({ ...toDomain(row), name, updatedAt: nowIso() });
      await db.checklistTemplates.put({ ...tpl, dirty: 1 });
    });
  },

  async softDelete(id: string): Promise<void> {
    const now = nowIso();
    await db.checklistTemplates.update(id, { deletedAt: now, updatedAt: now, dirty: 1 });
  },

  async restore(id: string): Promise<void> {
    await db.checklistTemplates.update(id, { deletedAt: undefined, updatedAt: nowIso(), dirty: 1 });
  },
};
