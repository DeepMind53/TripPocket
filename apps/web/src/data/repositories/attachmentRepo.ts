import { todayIn, uuidv7, type Trip } from '@trippocket/shared';
import { api } from '../api/client';
import { db, type AttachmentRow } from '../db';

/** 1개 상한 (사용자 결정 2026-10-25) — 서버와 같게 */
export const ATTACHMENT_MAX = 10 * 1024 * 1024;
const TYPES = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf)$/;

const ended = (trip: Pick<Trip, 'endDate' | 'timezone'>) => trip.endDate < todayIn(trip.timezone);

interface RemoteAttachment {
  id: string;
  tripId: string;
  bookingId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
}

async function uploadRow(row: AttachmentRow): Promise<boolean> {
  if (!row.blob) return false;
  const res = await api<RemoteAttachment>(
    `/api/trips/${encodeURIComponent(row.tripId)}/bookings/${encodeURIComponent(row.bookingId)}/attachments`,
    {
      method: 'POST',
      body: row.blob,
      headers: {
        'content-type': row.mime,
        'x-file-name': encodeURIComponent(row.name),
        'x-attachment-id': row.id,
      },
    },
  );
  if (res.ok) await db.attachments.update(row.id, { remote: 1 });
  return res.ok;
}

/**
 * 예약 문서 (docs/20 G2): 기기에 파일째 저장하고, 여행이 끝나기 전이면 서버에도 올려 동행·다른 기기와 나눈다.
 * 여행이 끝나면 서버는 지우고(services/attachments.ts) 기기에 받아 둔 것만 남는다
 */
export const attachmentRepo = {
  listByBooking(bookingId: string): Promise<AttachmentRow[]> {
    return db.attachments.where('bookingId').equals(bookingId).sortBy('createdAt');
  },

  /** 붙이기 — 너무 크거나 형식이 아니면 이유를 돌려준다 */
  async add(
    trip: Pick<Trip, 'id' | 'endDate' | 'timezone'>,
    bookingId: string,
    file: File,
  ): Promise<'too_large' | 'bad_type' | AttachmentRow> {
    if (file.size > ATTACHMENT_MAX) return 'too_large';
    if (!TYPES.test(file.type)) return 'bad_type';
    const row: AttachmentRow = {
      id: uuidv7(),
      tripId: trip.id,
      bookingId,
      name: file.name.slice(0, 120) || 'file',
      mime: file.type,
      size: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
      remote: 0,
    };
    await db.attachments.add(row);
    if (!ended(trip)) await uploadRow(row).catch(() => false);
    return row;
  },

  async remove(row: AttachmentRow): Promise<void> {
    await db.attachments.delete(row.id);
    if (row.remote)
      await api(`/api/attachments/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
  },

  /**
   * 서버와 맞추기 (예약 화면을 열 때): 서버에만 있는 것은 받아 두고, 기기에만 있는 것은 올린다.
   * 여행 중에 서버에서 사라진 것은 동행이 지운 것 → 기기에서도 지운다. 끝난 여행은 서버 목록이 비므로 건드리지 않는다
   */
  async syncTrip(trip: Pick<Trip, 'id' | 'endDate' | 'timezone'>): Promise<void> {
    if (ended(trip)) return;
    const res = await api<{ attachments: RemoteAttachment[] }>(
      `/api/trips/${encodeURIComponent(trip.id)}/attachments`,
    );
    if (!res.ok) return;
    const local = await db.attachments.where('tripId').equals(trip.id).toArray();
    const remoteIds = new Set(res.data.attachments.map((a) => a.id));
    for (const r of res.data.attachments) {
      const have = local.find((l) => l.id === r.id);
      if (have?.blob) continue;
      try {
        const file = await fetch(`/api/attachments/${encodeURIComponent(r.id)}`, {
          credentials: 'same-origin',
        });
        if (!file.ok) continue;
        await db.attachments.put({ ...r, blob: await file.blob(), remote: 1 });
      } catch {
        // 다음에 다시
      }
    }
    for (const l of local) {
      if (l.remote && !remoteIds.has(l.id)) await db.attachments.delete(l.id);
      else if (!l.remote) await uploadRow(l).catch(() => false);
    }
  },

  /** 기기 데이터 정리: 끝난 여행의 문서 (기기에만 있는 것) — 개수·용량 */
  async pastTripDocs(
    trips: readonly Pick<Trip, 'id' | 'endDate' | 'timezone'>[],
  ): Promise<AttachmentRow[]> {
    const past = new Set(trips.filter(ended).map((t) => t.id));
    const known = new Set(trips.map((t) => t.id));
    // 여행 자체를 지웠는데 남은 문서도 함께
    return (await db.attachments.toArray()).filter(
      (a) => past.has(a.tripId) || !known.has(a.tripId),
    );
  },

  async removeLocal(ids: readonly string[]): Promise<void> {
    await db.attachments.bulkDelete([...ids]);
  },
};
