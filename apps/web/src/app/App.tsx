import { lazy, Suspense, useState } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from '../shared/ui';
import { createAppRouter } from './router';
import { InAppBanner } from '../features/common/InAppBanner';
import { useSync } from '../data/sync/syncStore';

// 첫 로그인 때만 필요 → 그때 불러온다
const AccountChoiceSheet = lazy(async () => ({
  default: (await import('../features/me/AccountChoiceSheet')).AccountChoiceSheet,
}));

export function App() {
  const [router] = useState(createAppRouter);
  const needChoice = useSync((st) => st.choiceFor !== null);
  return (
    <>
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
