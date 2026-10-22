import { useState } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from '../shared/ui';
import { createAppRouter } from './router';
import { InAppBanner } from '../features/common/InAppBanner';

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <>
      <InAppBanner />
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
