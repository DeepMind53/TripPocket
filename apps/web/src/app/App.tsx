import { lazy, Suspense, useEffect, useState } from 'react';
import { ReadOnlyTripError } from '../data/tripRoles';
import { useTranslation } from '../i18n';
import { RouterProvider } from 'react-router';
import { Toaster, toast } from '../shared/ui';
import { createAppRouter } from './router';
import { InAppBanner } from '../features/common/InAppBanner';
import { MovedBanner } from '../features/common/MovedBanner';
import { useSync } from '../data/sync/syncStore';

// 첫 로그인 때만 필요 → 그때 불러온다
const AccountChoiceSheet = lazy(async () => ({
  default: (await import('../features/me/AccountChoiceSheet')).AccountChoiceSheet,
}));

export function App() {
  const [router] = useState(createAppRouter);
  const needChoice = useSync((st) => st.choiceFor !== null);
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
      <MovedBanner />
      <InAppBanner />
      <RouterProvider router={router} />
      {needChoice && (
        <Suspense fallback={null}>
          <AccountChoiceSheet />
        </Suspense>
      )}
      <Toaster />
    </>
  );
}
