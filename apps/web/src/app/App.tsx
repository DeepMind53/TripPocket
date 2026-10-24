import { lazy, Suspense, useEffect, useState } from 'react';
import { ReadOnlyTripError } from '../data/tripRoles';
import { useAuth } from '../data/authStore';
import { useLimitNotice } from '../data/limitNotice';
import { useTranslation } from '../i18n';
import { RouterProvider } from 'react-router';
import { Toaster, toast } from '../shared/ui';
import { createAppRouter } from './router';
import { InAppBanner } from '../features/common/InAppBanner';
import { MovedBanner } from '../features/common/MovedBanner';
import { OfflineBanner } from '../features/common/OfflineBanner';
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

export function App() {
  const [router] = useState(createAppRouter);
  const needChoice = useSync((st) => st.choiceFor !== null);
  const limited = useLimitNotice((s) => s.notice !== null);
  // 처음 로그인하면 닉네임부터 (멤버 목록에서 누가 누구인지 알아보게). 닫으면 이번에는 다시 묻지 않음
  const needNickname = useAuth((s) => s.status === 'user' && s.me?.nicknameSet === false);
  const [nicknameDismissed, setNicknameDismissed] = useState(false);
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
      {needChoice && (
        <Suspense fallback={null}>
          <AccountChoiceSheet />
        </Suspense>
      )}
      <Toaster />
    </>
  );
}
