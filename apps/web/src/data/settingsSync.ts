import { pickSynced, type Settings } from '@trippocket/shared';
import { api } from './api/client';
import { useAuth } from './authStore';
import { settingsRepo } from './repositories/settingsRepo';
import {
  applyRemoteSettings,
  currentSettings,
  SETTINGS_META_KEY,
  type SettingsMeta,
} from './settingsStore';

/**
 * 설정을 계정과 맞추기 (사용자 요청 2026-10-24 — 사용자마다 각자의 설정).
 * - 기기에서 바꾸면 settingsStore가 "바꾼 시각 + 아직 안 올림"을 남긴다 → 연결되면 올림 (오프라인이어도 기기에서는 바로 적용)
 * - 올릴 것이 없으면 계정 설정을 받아, 기기 것보다 나중에 바뀐 것이면 적용
 * - 같은 항목을 두 기기가 바꿨으면 나중에 바꾼 쪽이 이긴다 (서버가 시각으로 비교)
 * 기기별 설정(테마·글자 크기·진동)은 올리지 않는다 (shared DEVICE_SETTINGS)
 */
let running: Promise<void> | null = null;

export function syncSettings(): Promise<void> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

type Remote = { data: Partial<Settings> | null; updatedAt: string | null };

async function run(): Promise<void> {
  if (useAuth.getState().status !== 'user') return;
  const meta = await settingsRepo.get<SettingsMeta>(SETTINGS_META_KEY, {
    updatedAt: null,
    dirty: false,
  });
  if (meta.dirty && meta.updatedAt) {
    const res = await api<Remote>('/api/me/settings', {
      method: 'PUT',
      body: JSON.stringify({ data: pickSynced(currentSettings()), updatedAt: meta.updatedAt }),
    });
    // 실패(오프라인 등)하면 "안 올림"을 그대로 두고 다음 동기화 때 다시
    if (!res.ok) return;
    await settingsRepo.set(SETTINGS_META_KEY, {
      updatedAt: res.data.updatedAt,
      dirty: false,
    });
    // 다른 기기에서 더 나중에 바꿨으면 그것을 받는다
    if (res.data.data && res.data.updatedAt !== meta.updatedAt)
      await applyRemoteSettings(res.data.data);
    return;
  }
  const res = await api<Remote>('/api/me/settings');
  if (!res.ok || !res.data.data || !res.data.updatedAt) return;
  if (meta.updatedAt && res.data.updatedAt <= meta.updatedAt) return;
  await applyRemoteSettings(res.data.data);
  await settingsRepo.set(SETTINGS_META_KEY, {
    updatedAt: res.data.updatedAt,
    dirty: false,
  });
}
