import { lazy, Suspense, useEffect, useState } from 'react';
import { ReadOnlyTripError } from '../data/tripRoles';
import { useAuth } from '../data/authStore';
import { useLimitNotice } from '../data/limitNotice';
import { useTranslation } from '../i18n';
import { RouterProvider } from 'react-router';
import { Toaster, toast } from '../shared/ui';
import { createAppRouter } from './router';
import { useInstall } from './pwa';
import { InAppBanner } from '../features/common/InAppBanner';
import { MovedBanner } from '../features/common/MovedBanner';
import { OfflineBanner } from '../features/common/OfflineBanner';
import { PullToSync } from '../features/common/PullToSync';
import { FlightReminder } from '../features/common/FlightReminder';
import { useSync } from '../data/sync/syncStore';

// 첫 로그인 때만 필요 → 그때 불러온다
// 사용량 한도 안내 — 한도에 걸렸을 때만
const LimitNoticeSheet = lazy(async () => ({
  default: (await import('../features/common/LimitNoticeSheet')).LimitNoticeSheet,
}));
const NicknameSheet = lazy(async () => ({
  default: (await import('../features/me/NicknameSheet')).NicknameSheet,
}));
const AccountChoiceSheet = lazy(async () => ({
  default: (await import('../features/me/AccountChoiceSheet')).AccountChoiceSheet,
}));
const InstallSheet = lazy(async () => ({
  default: (await import('../features/me/InstallSheet')).InstallSheet,
}));

/** 처음 로그인한 뒤 홈 화면 추가 안내를 한 번 보여 줬음 (이 기기) */
const INSTALL_OFFERED_KEY = 'tp-install-offered';
function installOffered(): boolean {
  try {
    return localStorage.getItem(INSTALL_OFFERED_KEY) === '1';
  } catch {
    return true; // 저장 못 하는 브라우저면 매번 띄우지 않는다
  }
}

export function App() {
  const [router] = useState(createAppRouter);
  const needChoice = useSync((st) => st.choiceFor !== null);
  const limited = useLimitNotice((s) => s.notice !== null);
  // 처음 로그인하면 닉네임부터 (멤버 목록에서 누가 누구인지 알아보게). 닫으면 이번에는 다시 묻지 않음
  const needNickname = useAuth((s) => s.status === 'user' && s.me?.nicknameSet === false);
  const [nicknameDismissed, setNicknameDismissed] = useState(false);
  // 닉네임을 정한 다음, 설치하지 않은 기기에서 한 번만 홈 화면 추가 안내 (사용자 요청 2026-10-26)
  const signedIn = useAuth((s) => s.status === 'user');
  const installed = useInstall((s) => s.installed);
  const [installDone, setInstallDone] = useState(installOffered);
  const offerInstall =
    signedIn && !installed && !installDone && !needChoice && (!needNickname || nicknameDismissed);
  useEffect(() => {
    if (!offerInstall) return;
    try {
      localStorage.setItem(INSTALL_OFFERED_KEY, '1');
    } catch {
      // 저장 못 해도 이번 실행에서는 한 번만
    }
  }, [offerInstall]);
  const { t } = useTranslation();
  // 보기 전용 여행을 고치려 하면 저장소(db.ts)가 막는다 → 안내만 (화면 버튼은 미리 숨김)
  useEffect(() => {
    const onReject = (e: PromiseRejectionEvent) => {
      if (!(e.reason instanceof ReadOnlyTripError)) return;
      e.preventDefault();
      toast(t('share.readOnly.blocked'));
    };
    window.addEventListener('unhandledrejection', onReject);
    return () => window.removeEventListener('unhandledrejection', onReject);
  }, [t]);
  return (
    <>
      <OfflineBanner />
      <PullToSync />
      <MovedBanner />
      <InAppBanner />
      <RouterProvider router={router} />
      {needNickname && !needChoice && !nicknameDismissed && (
        <Suspense fallback={null}>
          <NicknameSheet open first onOpenChange={(o) => !o && setNicknameDismissed(true)} />
        </Suspense>
      )}
      {limited && (
        <Suspense fallback={null}>
          <LimitNoticeSheet />
        </Suspense>
      )}
      {offerInstall && (
        <Suspense fallback={null}>
          <InstallSheet open first onOpenChange={(o) => !o && setInstallDone(true)} />
        </Suspense>
      )}
      {needChoice && (
        <Suspense fallback={null}>
          <AccountChoiceSheet />
        </Suspense>
      )}
      {signedIn && <FlightReminder />}
      <Toaster />
    </>
  );
}
