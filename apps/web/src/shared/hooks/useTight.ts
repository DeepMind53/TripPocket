import { useSyncExternalStore } from 'react';

/**
 * 좁은 화면인지 (styles/index.css의 tight 변형과 같은 기준: 폭 340px 이하 또는 큰 글자 html[data-big-text]).
 * CSS만으로 자리를 옮길 수 없을 때 — 같은 버튼을 두 번 그리지 않고 한 곳에만 그리려고 (2026-11-23)
 */
const QUERY = '(max-width: 340px)';

function read(): boolean {
  const narrow = typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
  return narrow || document.documentElement.hasAttribute('data-big-text');
}

function subscribe(onChange: () => void): () => void {
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
  mq?.addEventListener('change', onChange);
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-big-text'] });
  return () => {
    mq?.removeEventListener('change', onChange);
    mo.disconnect();
  };
}

export function useTight(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
