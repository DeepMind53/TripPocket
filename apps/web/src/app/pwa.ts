import { create } from 'zustand';
import i18n from '../i18n';
import { useToastStore } from '../shared/ui/toastStore';

/** 설치 프롬프트(안드로이드 크롬)를 잡아 두었다가 설치 안내에서 쓴다 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useInstall = create<{ prompt: InstallPromptEvent | null; installed: boolean }>(() => ({
  prompt: null,
  installed: isStandalone(),
}));

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export type Platform = 'ios' | 'android' | 'other';
export function platform(ua = navigator.userAgent): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** 카톡·인스타·네이버 앱 등 앱 안 브라우저 — 저장 공간이 따로라 데이터가 사라질 수 있다 (docs/06 §2) */
export function inAppBrowser(ua = navigator.userAgent): 'kakao' | 'other' | null {
  if (/KAKAOTALK/i.test(ua)) return 'kakao';
  if (/Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps|Whale\/.*inapp|everytimeApp/i.test(ua))
    return 'other';
  return null;
}

export async function promptInstall(): Promise<boolean> {
  const e = useInstall.getState().prompt;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  useInstall.setState({ prompt: null, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}

/** 서비스 워커 등록 (배포 빌드에서만) + 새 버전 알림 */
export function setupPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstall.setState({ prompt: e as InstallPromptEvent });
  });
  window.addEventListener('appinstalled', () =>
    useInstall.setState({ installed: true, prompt: null }),
  );

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // 업데이트를 적용할 때만 새로고침 (처음 설치 때 서비스 워커가 화면을 맡는 것은 무시)
  const hadController = navigator.serviceWorker.controller !== null;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
  void navigator.serviceWorker.register('/sw.js').then((reg) => {
    const offer = (worker: ServiceWorker) => {
      // 처음 설치(이전 버전 없음)면 알릴 필요 없음
      if (!navigator.serviceWorker.controller) return;
      useToastStore.getState().show({
        message: i18n.t('pwa.updateReady'),
        action: { label: i18n.t('pwa.update'), onAction: () => worker.postMessage('SKIP_WAITING') },
        duration: 10 * 60_000,
      });
    };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') offer(worker);
      });
    });
    // 앱을 오래 켜 두어도 새 버전을 확인 (1시간마다)
    setInterval(() => void reg.update(), 3_600_000);
  });
}
