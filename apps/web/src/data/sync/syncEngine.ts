import { setMemberCounts, setTripRoles } from '../tripRoles';
import {
  SYNC_BATCH,
  SYNC_TABLES,
  type PullResult,
  type PushResult,
  type SyncTable,
} from '@trippocket/shared';
import { api } from '../api/client';
import { useAuth } from '../authStore';
import { db, toDomain } from '../db';

/**
 * 동기화 엔진 (docs/09 §6). 화면은 늘 기기 DB만 읽고, 이 엔진이 뒤에서 서버와 맞춘다.
 * 1) push: dirty 행을 올림 → 서버 rev 받으면 dirty 해제(그사이 또 고쳤으면 유지)
 * 2) pull: 마지막 rev 이후를 받음 → 기기에서 아직 안 올린 행은 덮어쓰지 않음
 * 서버가 없거나 꺼져 있으면 조용히 다음 기회에 (앱은 그대로 동작)
 */
export { useSync, type SyncState } from './syncStore';
import { useSync } from './syncStore';

const LAST_REV = 'lastRev';
const USER_ID = 'userId';

interface Row {
  id: string;
  updatedAt: string;
  rev?: number;
  dirty: 0 | 1;
  [k: string]: unknown;
}
const table = (t: SyncTable) =>
  db[t] as unknown as {
    where(i: string): {
      equals(v: number): {
        limit(n: number): { toArray(): Promise<Row[]> };
        count(): Promise<number>;
      };
    };
    get(id: string): Promise<Row | undefined>;
    put(row: Row): Promise<unknown>;
    update(id: string, changes: Partial<Row>): Promise<number>;
    delete(id: string): Promise<void>;
    filter(fn: (r: Row) => boolean): { toArray(): Promise<Row[]> };
  };

export async function getSyncValue<T>(key: string): Promise<T | undefined> {
  return (await db.syncState.get(key))?.value as T | undefined;
}
const setSyncValue = (key: string, value: unknown) => db.syncState.put({ key, value });

export async function pendingCount(): Promise<number> {
  let n = 0;
  for (const t of SYNC_TABLES) n += await table(t).where('dirty').equals(1).count();
  return n;
}

let running: Promise<void> | null = null;

/** 한 번 동기화 (이미 도는 중이면 그것을 기다림) */
export function syncNow(): Promise<void> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<void> {
  if (useAuth.getState().status !== 'user' || useSync.getState().choiceFor) return;
  useSync.setState({ state: 'syncing' });
  const ok = (await push()) && (await pull());
  // 설정도 계정과 맞춘다 (일정 동기화와 따로 — 실패해도 다음에 다시)
  if (ok === true) await (await import('../settingsSync')).syncSettings();
  useSync.setState(
    ok === true
      ? { state: 'idle', lastSyncedAt: new Date().toISOString() }
      : { state: ok === 'offline' ? 'offline' : 'error' },
  );
}

type Step = true | 'offline' | 'error';

async function push(): Promise<Step> {
  for (;;) {
    const batch: { table: SyncTable; row: Row }[] = [];
    for (const t of SYNC_TABLES) {
      if (batch.length >= SYNC_BATCH) break;
      const rows = await table(t)
        .where('dirty')
        .equals(1)
        .limit(SYNC_BATCH - batch.length)
        .toArray();
      batch.push(...rows.map((row) => ({ table: t, row })));
    }
    if (batch.length === 0) return true;
    const res = await api<PushResult>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        changes: batch.map(({ table: t, row }) => ({
          table: t,
          record: toDomain(row),
          baseRev: row.rev ?? null,
        })),
      }),
    });
    if (!res.ok) return fail(res.reason);
    const sent = new Map(batch.map((b) => [`${b.table}|${b.row.id}`, b.row.updatedAt]));
    await db.transaction(
      'rw',
      SYNC_TABLES.map((t) => db[t]),
      async () => {
        for (const a of res.data.applied) {
          const cur = await table(a.table).get(a.id);
          if (!cur) continue;
          // 보낸 뒤 또 고쳤으면 dirty 유지 (다음 push에서 올라감)
          const unchanged = cur.updatedAt === sent.get(`${a.table}|${a.id}`);
          await table(a.table).update(a.id, { rev: a.rev, ...(unchanged ? { dirty: 0 } : {}) });
        }
        // 서버가 거부한 행(권한·형식)은 다시 보내지 않는다 — 이 기기에는 남는다
        for (const r of res.data.rejected) await table(r.table).update(r.id, { dirty: 0 });
      },
    );
    if (res.data.rejected.length)
      useSync.setState((s) => ({ rejected: s.rejected + res.data.rejected.length }));
  }
}

async function pull(): Promise<Step> {
  let since = (await getSyncValue<number>(LAST_REV)) ?? 0;
  for (;;) {
    const res = await api<PullResult>(`/api/sync/pull?since=${since}&limit=${SYNC_BATCH}`);
    if (!res.ok) return fail(res.reason);
    if (res.data.roles) setTripRoles(res.data.roles);
    if (res.data.memberCounts) setMemberCounts(res.data.memberCounts);
    await db.transaction('rw', [...SYNC_TABLES.map((t) => db[t]), db.syncState], async () => {
      for (const c of res.data.changes) {
        const local = await table(c.table).get(c.record.id);
        if (local?.dirty) continue; // 기기에서 고친 것이 이긴다 (다음 push)
        if (c.table === 'checklistTemplates') await dropPristineTwin(c.record as Row);
        await table(c.table).put({ ...(c.record as Row), dirty: 0 });
      }
      since = res.data.nextRev;
      await setSyncValue(LAST_REV, since);
    });
    if (!res.data.hasMore) return true;
  }
}

/** 같은 이름의 기본 템플릿이 계정에서 오면, 이 기기에서 손대지 않은 기본 템플릿은 지운다 (중복 방지) */
async function dropPristineTwin(incoming: Row): Promise<void> {
  const twins = await table('checklistTemplates')
    .filter(
      (r) =>
        r.id !== incoming.id &&
        r.list === incoming.list &&
        r.name === incoming.name &&
        r.rev === undefined &&
        r.dirty === 0,
    )
    .toArray();
  for (const t of twins) await table('checklistTemplates').delete(t.id);
}

function fail(reason: 'unauthorized' | 'offline' | 'error' | 'limit'): Step {
  if (reason === 'unauthorized') useAuth.setState({ status: 'anon', me: null });
  return reason === 'offline' ? 'offline' : 'error';
}

/**
 * 로그인한 계정이 이 기기의 마지막 동기화 계정과 다른가 (첫 로그인·계정 바꿈).
 * 기기에 여행이 있으면 올릴지 물어야 한다 (docs/09 §6.3)
 */
export async function needsAccountChoice(userId: string): Promise<boolean> {
  if ((await getSyncValue<string>(USER_ID)) === userId) return false;
  const trips = await db.trips.filter((t) => !t.deletedAt).count();
  if (trips === 0) await setSyncValue(USER_ID, userId);
  return trips > 0;
}

/** 첫 로그인 선택: upload = 이 기기 데이터를 계정에 합침, replace = 이 기기 데이터를 지우고 계정 것만 */
export async function chooseAccountData(userId: string, mode: 'upload' | 'replace'): Promise<void> {
  if (mode === 'replace') {
    await db.transaction('rw', [...SYNC_TABLES.map((t) => db[t]), db.syncState], async () => {
      for (const t of SYNC_TABLES) await db[t].clear();
      await db.syncState.clear();
    });
  } else {
    // 다른 계정에서 받은 rev는 이 계정에 의미 없음 → 새로 올리도록
    await db.transaction('rw', [...SYNC_TABLES.map((t) => db[t]), db.syncState], async () => {
      for (const t of SYNC_TABLES)
        await (
          db[t] as unknown as {
            toCollection(): { modify(fn: (r: Row) => void): Promise<number> };
          }
        )
          .toCollection()
          .modify((r) => {
            delete r.rev;
            if (!(t === 'checklistTemplates' && r.dirty === 0)) r.dirty = 1;
          });
      await db.syncState.delete(LAST_REV);
    });
  }
  await setSyncValue(USER_ID, userId);
}
