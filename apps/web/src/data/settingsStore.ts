import {
  DEVICE_SETTINGS,
  mergePlanSeen,
  parseSettings,
  SETTINGS_DEFAULTS,
  type Settings,
} from '@trippocket/shared';
import { create } from 'zustand';
import { applyTheme } from '../shared/lib/theme';
import { setDateStyle } from '../shared/lib/dateFormat';
import { settingsRepo } from './repositories/settingsRepo';
import { countUse } from '../shared/lib/usageCount';

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
  // 글자 크기 3단계 (2026-11-10): 글자 토큰만 --tp-font 배율로 바꾼다 — 화면 전체 배율(html font-size)은 쓰지 않아
  // 버튼·간격은 그대로 (전체 배율로 줄였더니 누르는 영역이 44px 밑으로 내려감, CI 실행 219)
  document.documentElement.style.fontSize = '';
  document.documentElement.style.setProperty('--tp-font', String(s.fontScale));
  // 큰 글씨 배치(tight)는 115% 이상에서였다 — 가장 큰 단계가 99%라 이제 좁은 화면(≤340px)에서만
  document.documentElement.toggleAttribute('data-big-text', s.fontScale >= 1.15);
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
  migrateGraduatedLabs();
}

/**
 * 2026-11-10 실험실 → 설정 "일정"으로 옮긴 기능: 이 기기 실험실에서 켜 두었으면 설정도 켜고(안내 팝업은 다시 묻지 않음),
 * 실험실 저장에서는 지운다. 여행 모드는 이동 수단(travelMode)과 겹치지 않게 tripMode
 */
const GRADUATED_LABS = {
  offlineReady: 'offlineReady',
  safetyNotice: 'safetyNotice',
  festivals: 'festivals',
  flightDelay: 'flightDelay',
  travelMode: 'tripMode',
  // 일차 노선 미니맵·여행 전체 노선도 → 설정 "노선도" 하나로 (2026-11-10)
  dayMiniMap: 'routeMap',
  tripRouteMap: 'routeMap',
} as const;

function migrateGraduatedLabs(): void {
  let labs: Record<string, unknown>;
  try {
    labs = JSON.parse(localStorage.getItem('tp-labs') ?? '{}') as Record<string, unknown>;
  } catch {
    return;
  }
  const on = (Object.keys(GRADUATED_LABS) as (keyof typeof GRADUATED_LABS)[]).filter(
    (id) => labs[id] === true,
  );
  if (on.length === 0) return;
  const keys = [...new Set(on.map((id) => GRADUATED_LABS[id]))];
  const cur = currentSettings();
  updateSettings({
    ...Object.fromEntries(keys.map((k) => [k, true])),
    planPromptSeen: [...new Set([...cur.planPromptSeen, ...keys])],
  });
  try {
    for (const id of Object.keys(GRADUATED_LABS)) delete labs[id];
    localStorage.setItem('tp-labs', JSON.stringify(labs));
  } catch {
    // 못 지워도 다음 실행 때 같은 값으로 한 번 더 켤 뿐
  }
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
  for (const k of Object.keys(patch)) countUse(`setting.${k}`);
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
export async function applyRemoteSettings(
  remote: Partial<Settings>,
  otherAccount = false,
): Promise<void> {
  const cur = currentSettings();
  const device = Object.fromEntries(DEVICE_SETTINGS.map((k) => [k, cur[k]]));
  // 다른 계정으로 바뀌었으면 앞 사람의 설정·물어본 기록을 이어 쓰지 않는다
  const next = parseSettings(
    otherAccount
      ? { ...SETTINGS_DEFAULTS, ...remote, ...device }
      : {
          ...cur,
          ...remote,
          ...device,
          planPromptSeen: mergePlanSeen(cur.planPromptSeen, remote.planPromptSeen ?? []),
        },
  );
  useSettings.setState(next);
  applyDevice(next);
  await settingsRepo.set(KEY, next);
}

/**
 * 사용자가 저장한 기본값 (사용자 요청 2026-11-03): [지금 설정을 기본값으로 저장] → 되돌리기는 이 값으로.
 * 이 기기에만 (localStorage). 물어본 기록(planPrompt*)은 저장하지 않는다
 */
const USER_DEFAULTS_KEY = 'tp-settings-defaults';
const NOT_DEFAULTS: readonly (keyof Settings)[] = ['planPromptSeen', 'planPromptV'];

export function userDefaults(): Partial<Settings> | null {
  try {
    const raw = localStorage.getItem(USER_DEFAULTS_KEY);
    if (!raw) return null;
    // 저장한 값도 검사해서 틀린 항목은 처음 기본값으로
    const parsed = parseSettings({ ...(JSON.parse(raw) as object), planPromptV: 1 });
    const keys = Object.keys(JSON.parse(raw) as object) as (keyof Settings)[];
    return Object.fromEntries(keys.filter((k) => k in parsed).map((k) => [k, parsed[k]]));
  } catch {
    return null;
  }
}

export function saveUserDefaults(): void {
  const cur = currentSettings();
  const keep = (Object.keys(SETTINGS_DEFAULTS) as (keyof Settings)[]).filter(
    (k) => !NOT_DEFAULTS.includes(k),
  );
  try {
    localStorage.setItem(
      USER_DEFAULTS_KEY,
      JSON.stringify(Object.fromEntries(keep.map((k) => [k, cur[k]]))),
    );
  } catch {
    // 저장 못 하면 처음 기본값 그대로
  }
}

export function clearUserDefaults(): void {
  try {
    localStorage.removeItem(USER_DEFAULTS_KEY);
  } catch {
    // 지울 수 없으면 그대로
  }
}

/** 섹션별 "기본값으로 되돌리기" — 저장한 기본값이 있으면 그 값, 없으면 처음 기본값 */
export function resetSettings(keys: readonly (keyof Settings)[]): void {
  const mine = userDefaults() ?? {};
  updateSettings(Object.fromEntries(keys.map((k) => [k, mine[k] ?? SETTINGS_DEFAULTS[k]])));
}

/** 진동 (설정에서 끄면 안 함, 지원 안 하는 기기도 조용히 무시) */
export function haptic(ms = 10): void {
  if (useSettings.getState().haptics) navigator.vibrate?.(ms);
}
