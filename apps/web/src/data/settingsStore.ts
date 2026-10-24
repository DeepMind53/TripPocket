import {
  DEVICE_SETTINGS,
  parseSettings,
  SETTINGS_DEFAULTS,
  type Settings,
} from '@trippocket/shared';
import { create } from 'zustand';
import { applyTheme } from '../shared/lib/theme';
import { setDateStyle } from '../shared/lib/dateFormat';
import { settingsRepo } from './repositories/settingsRepo';

const KEY = 'settings';
/** 첫 화면이 깜빡이지 않게 테마·글자 크기는 localStorage에도 (index.html이 먼저 읽음) */
export const BOOT_KEY = 'tp-boot';

interface SettingsState extends Settings {
  loaded: boolean;
}

/** 설정은 화면 여러 곳에서 바로 읽으므로 메모리에 하나 두고, 바뀌면 DB에 저장한다 */
export const useSettings = create<SettingsState>(() => ({ ...SETTINGS_DEFAULTS, loaded: false }));

function applyDevice(s: Settings) {
  setDateStyle(s.dateFormat);
  applyTheme(s.theme);
  document.documentElement.style.fontSize =
    s.fontScale === 1 ? '' : `${Math.round(s.fontScale * 100)}%`;
  try {
    localStorage.setItem(BOOT_KEY, JSON.stringify({ theme: s.theme, fontScale: s.fontScale }));
  } catch {
    // 저장 못 해도 동작에는 문제 없음 (다음 실행 때 잠깐 기본 테마)
  }
}

/** 앱 시작 시 한 번 */
export async function loadSettings(): Promise<void> {
  const raw = await settingsRepo.get<unknown>(KEY, null);
  // 예전(9단계까지) 길찾기 이동수단 설정을 옮겨 온다
  const legacy = await settingsRepo.get<{ mode?: unknown } | null>('directions', null);
  const s = parseSettings({ travelMode: legacy?.mode, ...(raw as object | null) });
  applyDevice(s);
  useSettings.setState({ ...s, loaded: true });
}

/** 계정과 맞추기용: 마지막으로 바꾼 시각 + 아직 안 올렸는지 (data/settingsSync.ts) */
export const SETTINGS_META_KEY = 'settingsMeta';
export interface SettingsMeta {
  updatedAt: string | null;
  dirty: boolean;
}

export function currentSettings(): Settings {
  const { loaded: _loaded, ...cur } = useSettings.getState();
  return cur;
}

export function updateSettings(patch: Partial<Settings>): void {
  const next = parseSettings({ ...currentSettings(), ...patch });
  useSettings.setState(next);
  applyDevice(next);
  void settingsRepo.set(KEY, next);
  // 계정에 저장하는 항목이 바뀌었으면 "안 올림" 표시 → 연결되면 올림 (오프라인에서도 기기에는 바로 적용)
  if (Object.keys(patch).some((k) => !DEVICE_SETTINGS.includes(k as keyof Settings))) {
    void settingsRepo
      .set(SETTINGS_META_KEY, { updatedAt: new Date().toISOString(), dirty: true })
      .then(() => import('./settingsSync'))
      .then((m) => m.syncSettings());
  }
}

/** 계정에서 받은 설정 적용 (기기별 설정은 그대로) */
export async function applyRemoteSettings(remote: Partial<Settings>): Promise<void> {
  const cur = currentSettings();
  const device = Object.fromEntries(DEVICE_SETTINGS.map((k) => [k, cur[k]]));
  const next = parseSettings({ ...cur, ...remote, ...device });
  useSettings.setState(next);
  applyDevice(next);
  await settingsRepo.set(KEY, next);
}

/** 섹션별 "기본값으로 되돌리기" */
export function resetSettings(keys: readonly (keyof Settings)[]): void {
  updateSettings(Object.fromEntries(keys.map((k) => [k, SETTINGS_DEFAULTS[k]])));
}

/** 진동 (설정에서 끄면 안 함, 지원 안 하는 기기도 조용히 무시) */
export function haptic(ms = 10): void {
  if (useSettings.getState().haptics) navigator.vibrate?.(ms);
}
