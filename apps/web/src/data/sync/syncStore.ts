import { create } from 'zustand';

/** 동기화 상태 (화면 표시용 — 엔진 본체는 syncEngine.ts, 첫 화면에 싣지 않으려고 따로 둠) */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export const useSync = create<{
  state: SyncState;
  lastSyncedAt: string | null;
  /** 아직 서버에 안 올린 행 수 */
  pending: number;
  rejected: number;
  /** 첫 로그인(또는 계정 바뀜) — 이 기기 데이터를 어떻게 할지 물어야 하는 계정 id */
  choiceFor: string | null;
}>(() => ({ state: 'idle', lastSyncedAt: null, pending: 0, rejected: 0, choiceFor: null }));
