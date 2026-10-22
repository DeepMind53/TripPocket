export type ThemePref = 'light' | 'dark' | 'system';

/** <html data-theme> 설정. system이면 속성을 지워 OS 설정(prefers-color-scheme)을 따른다. */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
}
