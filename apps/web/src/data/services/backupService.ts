import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLE_NAMES,
  type BackupFile,
  type ParsedBackup,
  type PhotoBackup,
} from '@trippocket/shared';
import { db, toDomain, type PhotoRow } from '../db';
import { LAST_BACKUP_KEY } from '../repositories/backupMeta';

/** 백업 만들기·복원 (docs/06 §3). 파일 형식 확인은 shared의 parseBackup */

/** 설정 표에서 백업하지 않는 것: 다시 받을 수 있는 캐시, 백업 시각 자체 */
const isCacheKey = (key: string) =>
  key.startsWith('holidays:') ||
  key.startsWith('weather:') ||
  key === 'fxCache' ||
  key === LAST_BACKUP_KEY;

const tables = () => [...BACKUP_TABLE_NAMES.map((t) => db[t]), db.settings];

/** 바이트 ⇄ base64 (사진을 백업 JSON에 넣을 때) */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  // 한 번에 넘기면 큰 사진에서 호출 스택이 넘친다 — 32KB씩
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await new Response(blob).arrayBuffer());
  return `data:${blob.type || 'image/jpeg'};base64,${bytesToBase64(bytes)}`;
}

/** data: 주소 → Blob (CSP connect-src 때문에 fetch(data:) 대신 직접 푼다) */
function dataUrlToBlob(url: string): Blob {
  const type = /^data:([^;,]+)/.exec(url)?.[1] ?? 'image/jpeg';
  return new Blob([base64ToBytes(url.slice(url.indexOf(',') + 1))], { type });
}

async function photosForBackup(): Promise<PhotoBackup[]> {
  const rows = await db.photos.toArray();
  const out: PhotoBackup[] = [];
  for (const { blob, ...rest } of rows) {
    const p: PhotoBackup = {
      id: rest.id,
      tripId: rest.tripId,
      itemId: rest.itemId,
      kind: rest.kind,
      createdAt: rest.createdAt,
      image: await blobToDataUrl(blob),
    };
    if (rest.text !== undefined) p.text = rest.text;
    if (rest.textSource !== undefined) p.textSource = rest.textSource;
    if (rest.tag !== undefined) p.tag = rest.tag;
    out.push(p);
  }
  return out;
}

/** 사진·영수증 수와 크기 (백업 화면의 [사진도 넣기] 옆) */
export async function photoStats(): Promise<{ count: number; bytes: number }> {
  const rows = await db.photos.toArray();
  return { count: rows.length, bytes: rows.reduce((n, r) => n + r.blob.size, 0) };
}

/** photos: 사진·영수증도 넣기 (사용자 결정 2026-11-13 — 기본은 빼서 파일을 작게) */
export async function createBackup({
  photos = false,
}: { photos?: boolean } = {}): Promise<BackupFile> {
  const data: BackupFile['data'] = {};
  await db.transaction('r', tables(), async () => {
    for (const t of BACKUP_TABLE_NAMES) data[t] = (await db[t].toArray()).map((r) => toDomain(r));
    data.settings = (await db.settings.toArray()).filter((r) => !isCacheKey(r.key));
  });
  // 사진 읽기는 트랜잭션 밖에서 (기다리는 동안 트랜잭션이 닫힌다)
  if (photos) {
    const list = await photosForBackup();
    if (list.length > 0) data.photos = list;
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** 여행 1건만 (S-25 파일로 내보내기) — 받은 사람은 백업·복원의 "합치기"로 가져온다 */
export async function createTripBackup(tripId: string): Promise<BackupFile> {
  const file = await createBackup();
  const own = (rows: unknown[] | undefined) =>
    (rows ?? []).filter((r) => (r as { tripId?: string }).tripId === tripId);
  file.data = {
    trips: (file.data.trips ?? []).filter((t) => (t as { id: string }).id === tripId),
    items: own(file.data.items),
    bookings: own(file.data.bookings),
    checklistItems: own(file.data.checklistItems),
  };
  return file;
}

/** 파일 이름: trippocket-backup-2026-10-23.json */
export function backupFileName(file: BackupFile): string {
  return `trippocket-backup-${file.exportedAt.slice(0, 10)}.json`;
}

export { lastBackupAt, markBackedUp } from '../repositories/backupMeta';

export type RestoreMode = 'merge' | 'replace';

interface Table {
  clear(): Promise<void>;
  bulkGet(ids: string[]): Promise<({ updatedAt?: string } | undefined)[]>;
  bulkPut(rows: unknown[]): Promise<unknown>;
}

/**
 * 복원. 한 번의 트랜잭션 — 실패하면 아무것도 바뀌지 않는다.
 * - merge: 같은 id는 updatedAt이 더 최근인 쪽, 없는 건 추가
 * - replace: 지금 데이터를 지우고 백업으로 (캐시는 남김)
 * 들어온 행은 동기화 대상으로 표시 (dirty)
 * 사진: 파일에 있을 때만 — merge는 없는 것만 더하고, replace는 이 기기 사진을 파일 것으로 바꾼다.
 * 파일에 사진이 없으면 이 기기 사진은 그대로 둔다 (기기 전용이라 다른 곳에 사본이 없다)
 */
export async function restoreBackup(
  parsed: Extract<ParsedBackup, { ok: true }>,
  mode: RestoreMode,
): Promise<void> {
  // Blob 만들기는 트랜잭션 밖에서 (안에서 기다리면 트랜잭션이 닫힌다)
  const photos: PhotoRow[] = parsed.photos.map(({ image, ...p }) => ({
    ...p,
    blob: dataUrlToBlob(image),
  }));
  await db.transaction('rw', [...tables(), db.photos], async () => {
    if (photos.length > 0) {
      if (mode === 'replace') {
        await db.photos.clear();
        await db.photos.bulkPut(photos);
      } else {
        const have = await db.photos.bulkGet(photos.map((p) => p.id));
        await db.photos.bulkPut(photos.filter((_, i) => !have[i]));
      }
    }
    for (const t of BACKUP_TABLE_NAMES) {
      const table = db[t] as unknown as Table;
      const rows = parsed.data[t];
      let put = rows;
      if (mode === 'replace') await table.clear();
      else {
        const existing = await table.bulkGet(rows.map((r) => r.id));
        put = rows.filter((r, i) => (r.updatedAt ?? '') > (existing[i]?.updatedAt ?? ''));
      }
      await table.bulkPut(put.map((r) => ({ ...r, dirty: 1 })));
    }
    if (mode === 'replace') {
      const keep = (await db.settings.toArray()).filter((r) => isCacheKey(r.key));
      await db.settings.clear();
      await db.settings.bulkPut(keep);
    }
    await db.settings.bulkPut(parsed.settings.filter((r) => !isCacheKey(r.key)));
  });
}
