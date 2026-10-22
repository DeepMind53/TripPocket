import { parseSettings, SETTINGS_DEFAULTS, type Settings } from '@trippocket/shared';
import { create } from 'zustand';
import { applyTheme } from '../shared/lib/theme';
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

export function updateSettings(patch: Partial<Settings>): void {
  const { loaded: _loaded, ...cur } = useSettings.getState();
  const next = parseSettings({ ...cur, ...patch });
  useSettings.setState(next);
  applyDevice(next);
  void settingsRepo.set(KEY, next);
}

/** 섹션별 "기본값으로 되돌리기" */
export function resetSettings(keys: readonly (keyof Settings)[]): void {
  updateSettings(Object.fromEntries(keys.map((k) => [k, SETTINGS_DEFAULTS[k]])));
}

/** 진동 (설정에서 끄면 안 함, 지원 안 하는 기기도 조용히 무시) */
export function haptic(ms = 10): void {
  if (useSettings.getState().haptics) navigator.vibrate?.(ms);
}
