import { liveQuery } from 'dexie';
import { refreshMe, useAuth } from '../authStore';
import { needsAccountChoice, pendingCount, syncNow, useSync } from './syncEngine';

/**
 * 동기화 시점 (docs/09 §6.3): 앱 시작, 온라인 복귀, 화면 복귀, 고친 뒤 3초, 앱을 보는 동안 30초마다.
 * 로그인하지 않았으면 아무것도 하지 않는다
 */
export function startSync(): void {
  let debounce: number | undefined;
  const soon = (ms: number) => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void syncNow(), ms);
  };

  // 로그인 상태가 "로그인됨"이 되면: 첫 로그인이면 묻고, 아니면 바로 동기화
  useAuth.subscribe((s, prev) => {
    if (s.status === 'user' && s.me && prev.status !== 'user') {
      const userId = s.me.id;
      void needsAccountChoice(userId).then((ask) => {
        if (ask) useSync.setState({ choiceFor: userId });
        else void syncNow();
      });
    }
  });
  void refreshMe();

  window.addEventListener('online', () => soon(500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') soon(500);
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 30_000);

  // 기기에서 고친 것이 생기면 3초 뒤 올림
  liveQuery(pendingCount).subscribe({
    next: (n) => {
      useSync.setState({ pending: n });
      if (n > 0 && !useSync.getState().choiceFor) soon(3000);
    },
  });
}
