/**
 * 이 기기에 둔 최근 백업 (2026-11-12 사용자 요청 — 복원할 때 저장한 백업 파일을 찾기 어려움).
 * [지금 백업 파일 만들기]를 할 때마다 같은 파일을 브라우저 전용 파일 공간(OPFS)에도 넣고 최근 3개만 남긴다.
 * IndexedDB 표가 아니라 파일이라 DB 구조(Dexie 버전)는 그대로. 기기 DB를 지워도 남지만, 브라우저의 사이트 데이터를
 * 지우면 함께 지워진다 — 기기를 바꿀 때는 여전히 파일(드라이브·카톡)로 옮겨야 한다.
 * OPFS가 없는 브라우저(오래된 사파리 등)에서는 조용히 아무것도 하지 않는다
 */
const DIR = 'backups';
export const LOCAL_BACKUP_KEEP = 3;

export interface LocalBackup {
  name: string;
  size: number;
  /** 저장한 시각 (ms) */
  savedAt: number;
}

async function dir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage?.getDirectory?.();
    return root ? await root.getDirectoryHandle(DIR, { create: true }) : null;
  } catch {
    return null;
  }
}

async function entries(
  d: FileSystemDirectoryHandle,
): Promise<{ h: FileSystemFileHandle; f: File }[]> {
  const out: { h: FileSystemFileHandle; f: File }[] = [];
  // reason: TS DOM 타입에 디렉터리 values()가 아직 없다 (브라우저는 지원)
  const it = (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
  for await (const h of it) {
    if (h.kind === 'file' && h.name.endsWith('.json')) {
      const fh = h as FileSystemFileHandle;
      out.push({ h: fh, f: await fh.getFile() });
    }
  }
  return out.sort((a, b) => b.f.lastModified - a.f.lastModified);
}

/** 백업 파일 한 개 넣기 (같은 이름이면 덮어씀) — 최근 3개만 남긴다. 실패해도 백업 자체에는 영향 없음 */
export async function saveLocalBackup(name: string, json: string): Promise<boolean> {
  const d = await dir();
  if (!d) return false;
  try {
    const h = await d.getFileHandle(name, { create: true });
    const w = await h.createWritable();
    await w.write(json);
    await w.close();
    for (const old of (await entries(d)).slice(LOCAL_BACKUP_KEEP)) await d.removeEntry(old.h.name);
    return true;
  } catch {
    return false;
  }
}

/** 최근 것부터 */
export async function listLocalBackups(): Promise<LocalBackup[]> {
  const d = await dir();
  if (!d) return [];
  try {
    return (await entries(d)).map(({ f }) => ({
      name: f.name,
      size: f.size,
      savedAt: f.lastModified,
    }));
  } catch {
    return [];
  }
}

export async function readLocalBackup(name: string): Promise<string | null> {
  const d = await dir();
  if (!d) return null;
  try {
    return await (await (await d.getFileHandle(name)).getFile()).text();
  } catch {
    return null;
  }
}

/** 이름: 같은 날 여러 번 만들어도 겹치지 않게 시각까지 */
export const localBackupName = (exportedAt: string) =>
  `trippocket-backup-${exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
