export type ThemePref = 'light' | 'dark' | 'system';

/** 휴대폰 맨 위 상태 표시줄 색 = 앱 바탕색 (index.html·public/boot.js와 같은 값) */
const BAR = { light: '#FFFFFF', dark: '#0F1115' } as const;

/**
 * <html data-theme> 설정. system이면 속성을 지워 OS 설정(prefers-color-scheme)을 따른다.
 * 상태 표시줄 색(theme-color)도 앱 테마를 따른다 — 휴대폰은 밝은데 앱만 다크면 흰 띠가 남았다 (docs/31 R6)
 */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    // 처음 media 값(라이트·다크 두 줄)을 기억해 두었다가 '시스템'이면 되돌린다
    const media = m.dataset.media ?? m.getAttribute('media') ?? '';
    m.dataset.media = media;
    if (pref === 'system') {
      if (media) m.setAttribute('media', media);
      m.content = media.includes('dark') ? BAR.dark : BAR.light;
    } else {
      m.removeAttribute('media');
      m.content = BAR[pref];
    }
  }
}
