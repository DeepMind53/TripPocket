import { createBrowserRouter, type RouteObject } from 'react-router';
import { StartPage } from './StartPage';

// 3단계(앱 셸)에서 탭·여행 상세 라우트로 확장한다. docs/03-architecture.md §6
export const routes: RouteObject[] = [
  { path: '/', element: <StartPage /> },
  {
    path: '/dev/ui',
    lazy: async () => {
      const { DevUiPage } = await import('../features/dev/DevUiPage');
      return { Component: DevUiPage };
    },
  },
];

export const router = createBrowserRouter(routes);
