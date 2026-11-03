import { lazy, Suspense, useEffect, useState } from 'react';
import { ReadOnlyTripError } from '../data/tripRoles';
import { useAuth } from '../data/authStore';
import { useLimitNotice } from '../data/limitNotice';
import { useTranslation } from '../i18n';
import { RouterProvider } from 'react-router';
import { Toaster, toast } from '../shared/ui';
import { createAppRouter } from './router';
import { useKeyboardScroll } from '../shared/hooks/useKeyboardScroll';
import { countUse, screenName } from '../data/usageStats';
import { useInstall } from './pwa';
import { InAppBanner } from '../features/common/InAppBanner';
import { MovedBanner } from '../features/common/MovedBanner';
import { OfflineBanner } from '../features/common/OfflineBanner';
import { PullToSync } from '../features/common/PullToSync';
import { FlightReminder } from '../features/common/FlightReminder';
import { useSync } from '../data/sync/syncStore';
import { useSettings } from '../data/settingsStore';

// Plan B 아침 컨디션 체크 (실험실) — 켰을 때만
const ConditionCheck = lazy(() => import('../features/itinerary/ConditionCheck'));
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
const AdminMonthlyNotice = lazy(async () => ({
  default: (await import('../features/me/AdminMonthlyNotice')).AdminMonthlyNotice,
}));
const PlanFeaturePrompt = lazy(async () => ({
  default: (await import('../features/me/PlanFeaturePrompt')).PlanFeaturePrompt,
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
  // 입력칸을 누르면 자판 위로 올리기 (모든 화면·시트 공통)
  useKeyboardScroll();
  // 앱 열기(오프라인 여부)·화면 오류 횟수 (ADR-0009) — 오류 내용은 보내지 않는다
  useEffect(() => {
    countUse(navigator.onLine ? 'app.open' : 'app.open.offline');
    const onError = () => countUse('error.screen');
    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
  }, []);
  // 화면·시트 열기 횟수 (ADR-0009): 경로의 id는 :id로, 시트는 이름만
  useEffect(() => {
    let last = '';
    return router.subscribe((s) => {
      const sheet = (s.location.state as { sheet?: unknown } | null)?.sheet;
      const key = `${s.location.pathname}|${typeof sheet === 'string' ? sheet : ''}`;
      if (key === last || s.navigation.state !== 'idle') return;
      const [path] = key.split('|');
      if (path !== last.split('|')[0]) countUse(screenName(s.location.pathname));
      if (typeof sheet === 'string' && sheet) countUse(`sheet:${sheet}`);
      last = key;
    });
  }, [router]);
  const needChoice = useSync((st) => st.choiceFor !== null);
  const limited = useLimitNotice((s) => s.notice !== null);
  // 처음 로그인하면 닉네임부터 (멤버 목록에서 누가 누구인지 알아보게). 닫으면 이번에는 다시 묻지 않음
  const needNickname = useAuth((s) => s.status === 'user' && s.me?.nicknameSet === false);
  const [nicknameDismissed, setNicknameDismissed] = useState(false);
  // 닉네임을 정한 다음, 설치하지 않은 기기에서 한 번만 홈 화면 추가 안내 (사용자 요청 2026-10-26)
  const signedIn = useAuth((s) => s.status === 'user');
  const planOn = useSettings((st) => st.planB);
  const isAdmin = useAuth((s) => s.status === 'user' && s.me?.isAdmin === true);
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
  // 지운 지 7일 넘은 기록은 한가할 때 기기에서 정리 (삭제 기록 복원, 2026-10-27)
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 3000));
    idle(() => void import('../data/repositories/trashRepo').then((m) => m.trashRepo.purge()));
    // 만든 지 24시간 지난 샘플 여행은 지운다 (실험실 샘플 테스트, 2026-11-03)
    idle(
      () => void import('../data/labSample').then((m) => m.removeLabSample({ expiredOnly: true })),
    );
  }, []);
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
      {/* 다른 첫 안내가 다 끝난 뒤에 */}
      {signedIn &&
        !needChoice &&
        !limited &&
        !offerInstall &&
        (!needNickname || nicknameDismissed) && (
          <Suspense fallback={null}>
            <PlanFeaturePrompt />
          </Suspense>
        )}
      {signedIn && <FlightReminder />}
      {/* Plan B (실험실): 여행 중 아침 컨디션 체크 — 켰을 때만 불러온다 */}
      {signedIn && planOn && (
        <Suspense fallback={null}>
          <ConditionCheck />
        </Suspense>
      )}
      {isAdmin && (
        <Suspense fallback={null}>
          <AdminMonthlyNotice />
        </Suspense>
      )}
      <Toaster />
    </>
  );
}
