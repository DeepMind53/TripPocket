import { BookingSchema, compareKeys, uuidv7, type Booking } from '@trippocket/shared';
import { nowIso } from '../clock';
import { db, toDomain } from '../db';

export type NewBooking = Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'rev'>;
type Editable = Omit<NewBooking, 'tripId'>;
/** 값을 undefined로 주면 그 항목을 지운다 */
export type BookingPatch = { [K in keyof Editable]?: Editable[K] | undefined };

/** 예약 시작 시각 순 (날짜 → 시간, 시간 없으면 그날 맨 앞) */
export function compareBookings(a: Booking, b: Booking): number {
  return (
    compareKeys(a.start.date, b.start.date) ||
    compareKeys(a.start.time ?? '', b.start.time ?? '') ||
    compareKeys(a.id, b.id)
  );
}

export const bookingRepo = {
  async create(input: NewBooking): Promise<Booking> {
    const now = nowIso();
    const booking = BookingSchema.parse({ ...input, id: uuidv7(), createdAt: now, updatedAt: now });
    await db.bookings.add({ ...booking, dirty: 1 });
    return booking;
  },

  async get(id: string): Promise<Booking | undefined> {
    const row = await db.bookings.get(id);
    return row && !row.deletedAt ? toDomain(row) : undefined;
  },

  async listByTrip(tripId: string): Promise<Booking[]> {
    const rows = await db.bookings
      .where('tripId')
      .equals(tripId)
      .filter((r) => !r.deletedAt)
      .toArray();
    return rows.map(toDomain).sort(compareBookings);
  },

  async update(id: string, patch: BookingPatch): Promise<Booking> {
    return db.transaction('rw', db.bookings, async () => {
      const row = await db.bookings.get(id);
      if (!row || row.deletedAt) throw new Error(`예약을 찾을 수 없어요: ${id}`);
      const merged: Record<string, unknown> = { ...toDomain(row), ...patch, updatedAt: nowIso() };
      for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
      const booking = BookingSchema.parse(merged);
      await db.bookings.put({ ...booking, dirty: 1 });
      return booking;
    });
  },

  async softDelete(id: string): Promise<void> {
    const now = nowIso();
    await db.bookings.update(id, { deletedAt: now, updatedAt: now, dirty: 1 });
  },

  async restore(id: string): Promise<void> {
    await db.bookings.update(id, { deletedAt: undefined, updatedAt: nowIso(), dirty: 1 });
  },
};
