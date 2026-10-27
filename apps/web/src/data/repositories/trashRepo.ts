import type {
  Booking,
  ChecklistItem,
  ChecklistTemplate,
  ItineraryItem,
  SavedPlace,
} from '@trippocket/shared';
import { db } from '../db';
import { canEditTrip } from '../tripRoles';
import { bookingRepo } from './bookingRepo';
import { checklistRepo, isMyChecklistItem } from './checklistRepo';
import { itemRepo } from './itemRepo';
import { savedPlaceRepo } from './savedPlaceRepo';
import { templateRepo } from './templateRepo';
import { tripRepo } from './tripRepo';

/** 지운 것을 되살릴 수 있는 기간 (사용자 결정 2026-10-27 — 용량 때문에 1주일) */
export const TRASH_DAYS = 7;
const KEEP_MS = TRASH_DAYS * 24 * 60 * 60 * 1000;
/** 여행과 함께 지운 것으로 보는 시간 차 — 여행을 되살리면 같이 되살린다 */
const SAME_BATCH_MS = 2 * 60 * 1000;

export type TrashKind = 'trip' | 'item' | 'booking' | 'checklist' | 'saved' | 'template';

export interface TrashEntry {
  kind: TrashKind;
  id: string;
  title: string;
  deletedAt: string;
  /** 여행 안의 것이면 그 여행 (여행 이름 표시) */
  tripId?: string | undefined;
}

const recent = (deletedAt: string | undefined, now: number) =>
  !!deletedAt && now - Date.parse(deletedAt) < KEEP_MS;

/**
 * 삭제 기록 복원 (마이 → 삭제 기록 복원, 사용자 요청 2026-10-27).
 * 기기 DB에 남은 삭제 표시(deletedAt)를 7일 동안 보여 주고 되살린다. 함께 쓰는 여행은 다른 멤버가 지운 것도
 * 동기화로 받아 오므로 소유자 기기에서도 보이고 되살릴 수 있다 (고칠 권한이 있는 여행만)
 */
export const trashRepo = {
  async list(now = Date.now()): Promise<TrashEntry[]> {
    const [trips, items, bookings, checklist, saved, templates] = await Promise.all([
      db.trips.filter((r) => recent(r.deletedAt, now)).toArray(),
      db.items.filter((r) => recent(r.deletedAt, now)).toArray(),
      db.bookings.filter((r) => recent(r.deletedAt, now)).toArray(),
      db.checklistItems.filter((r) => recent(r.deletedAt, now)).toArray(),
      db.savedPlaces.filter((r) => recent(r.deletedAt, now)).toArray(),
      db.checklistTemplates.filter((r) => recent(r.deletedAt, now)).toArray(),
    ]);
    const deletedTrips = new Set(trips.map((t) => t.id));
    // 지운 여행 안의 것은 여행 한 줄로 (여행을 되살리면 함께)
    const inLiveTrip = <T extends { tripId: string }>(r: T) =>
      !deletedTrips.has(r.tripId) && canEditTrip(r.tripId);
    const out: TrashEntry[] = [
      ...trips
        .filter((t) => canEditTrip(t.id))
        .map((t) => ({ kind: 'trip' as const, id: t.id, title: t.title, deletedAt: t.deletedAt! })),
      ...items.filter(inLiveTrip).map((i: ItineraryItem) => ({
        kind: 'item' as const,
        id: i.id,
        title: i.kind === 'note' ? (i.memo ?? i.title).split('\n')[0]! : i.title,
        deletedAt: i.deletedAt!,
        tripId: i.tripId,
      })),
      ...bookings.filter(inLiveTrip).map((b: Booking) => ({
        kind: 'booking' as const,
        id: b.id,
        title: b.title,
        deletedAt: b.deletedAt!,
        tripId: b.tripId,
      })),
      // 준비물은 사람별 — 내 것만 (일행 것은 그 사람만 되살린다. 보기 전용 멤버도 자기 것은 됨)
      ...checklist
        .filter((c) => !deletedTrips.has(c.tripId) && isMyChecklistItem(c))
        .map((c: ChecklistItem) => ({
          kind: 'checklist' as const,
          id: c.id,
          title: c.text,
          deletedAt: c.deletedAt!,
          tripId: c.tripId,
        })),
      ...saved.map((s: SavedPlace) => ({
        kind: 'saved' as const,
        id: s.id,
        title: s.name,
        deletedAt: s.deletedAt!,
      })),
      ...templates.map((tp: ChecklistTemplate) => ({
        kind: 'template' as const,
        id: tp.id,
        title: tp.name,
        deletedAt: tp.deletedAt!,
      })),
    ];
    return out.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  },

  /** 되살리기. 여행이면 그때 함께 지운 일정·예약·준비물도 */
  async restore(e: Pick<TrashEntry, 'kind' | 'id'>): Promise<void> {
    switch (e.kind) {
      case 'trip': {
        const trip = await db.trips.get(e.id);
        if (!trip?.deletedAt) return;
        const at = Date.parse(trip.deletedAt);
        const near = (d?: string) => !!d && Math.abs(Date.parse(d) - at) <= SAME_BATCH_MS;
        await tripRepo.restore(e.id);
        for (const i of await db.items.where('tripId').equals(e.id).toArray())
          if (near(i.deletedAt)) await itemRepo.restore(i.id);
        for (const b of await db.bookings.where('tripId').equals(e.id).toArray())
          if (near(b.deletedAt)) await bookingRepo.restore(b.id);
        for (const c of await db.checklistItems.where('tripId').equals(e.id).toArray())
          if (near(c.deletedAt) && isMyChecklistItem(c)) await checklistRepo.restore(c.id);
        return;
      }
      case 'item':
        return itemRepo.restore(e.id);
      case 'booking':
        return bookingRepo.restore(e.id);
      case 'checklist':
        return checklistRepo.restore(e.id);
      case 'saved':
        return savedPlaceRepo.restore(e.id);
      case 'template':
        return templateRepo.restore(e.id);
    }
  },

  /**
   * 7일 넘은 삭제 표시는 기기에서 아예 지운다 (용량). 서버에 아직 안 올린 것(dirty)은 남긴다 —
   * 올라간 뒤 다음 정리 때 지워진다. 지운 수를 돌려준다
   */
  async purge(now = Date.now()): Promise<number> {
    const old = (r: { deletedAt?: string | undefined; dirty: number }) =>
      !!r.deletedAt && now - Date.parse(r.deletedAt) >= KEEP_MS && r.dirty === 0;
    let n = 0;
    for (const table of [
      db.trips,
      db.items,
      db.bookings,
      db.checklistItems,
      db.savedPlaces,
      db.checklistTemplates,
    ] as const) {
      const ids = (await (table as typeof db.items).filter(old).primaryKeys()) as string[];
      await (table as typeof db.items).bulkDelete(ids);
      n += ids.length;
    }
    return n;
  },
};
