import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { AuthGate } from './AuthGate';
import { AppShell } from './layouts/AppShell';
import { NotFoundPage } from './NotFoundPage';

// 라우트 표: docs/code-map.md
const allRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      // 첫 화면(홈) 밖의 탭은 누를 때 불러온다 (첫 화면 크기 예산, 설치 후에는 기기에 저장돼 바로 열림)
      {
        path: 'trips',
        lazy: async () => ({ Component: (await import('../features/trips/TripsPage')).TripsPage }),
      },
      {
        path: 'saved',
        lazy: async () => ({ Component: (await import('../features/saved/SavedPage')).SavedPage }),
      },
      {
        path: 'me',
        lazy: async () => ({ Component: (await import('../features/me/MePage')).MePage }),
      },
    ],
  },
  {
    // 만들기 화면은 열 때만 불러온다 (도시 목록·달력 포함)
    path: 'trips/new',
    lazy: async () => {
      const { NewTripPage } = await import('../features/trips/NewTripPage');
      return { Component: NewTripPage };
    },
  },
  {
    path: 'trips/:tripId/settings',
    lazy: async () => ({
      Component: (await import('../features/trips/TripSettingsPage')).TripSettingsPage,
    }),
  },
  {
    path: 'trips/:tripId',
    lazy: async () => ({ Component: (await import('./layouts/TripLayout')).TripLayout }),
    children: [
      { index: true, element: <Navigate to="plan" replace /> },
      // 여행 탭 화면은 열 때 불러온다 (첫 화면 크기 줄이기)
      {
        path: 'plan',
        lazy: async () => ({
          Component: (await import('../features/itinerary/PlanPage')).PlanPage,
        }),
      },
      {
        path: 'places',
        lazy: async () => ({
          Component: (await import('../features/places/PlacesPage')).PlacesPage,
        }),
      },
      {
        path: 'bookings',
        lazy: async () => ({
          Component: (await import('../features/bookings/BookingsPage')).BookingsPage,
        }),
      },
      {
        path: 'checklist',
        lazy: async () => ({
          Component: (await import('../features/checklist/ChecklistPage')).ChecklistPage,
        }),
      },
    ],
  },
  {
    path: 'settings',
    lazy: async () => ({
      Component: (await import('../features/settings/SettingsPage')).SettingsPage,
    }),
  },
  {
    path: 's/:shareId',
    lazy: async () => ({
      Component: (await import('../features/share/PublicTripPage')).PublicTripPage,
    }),
  },
  {
    path: 'invite/:token',
    lazy: async () => ({
      Component: (await import('../features/share/InvitePage')).InvitePage,
    }),
  },
  {
    path: 'legal/:doc',
    lazy: async () => ({
      Component: (await import('../features/legal/LegalPage')).LegalPage,
    }),
  },
  {
    path: 'ai',
    lazy: async () => ({
      Component: (await import('../features/ai/AiPage')).AiPage,
    }),
  },
  {
    path: 'fx',
    lazy: async () => ({
      Component: (await import('../features/fx/FxPage')).FxPage,
    }),
  },
  {
    path: 'login',
    lazy: async () => ({
      Component: (await import('../features/me/LoginPage')).LoginPage,
    }),
  },
  {
    path: 'labs',
    lazy: async () => ({
      Component: (await import('../features/labs/LabsPage')).LabsPage,
    }),
  },
  {
    path: 'admin/api-usage',
    lazy: async () => ({
      Component: (await import('../features/me/ApiUsagePage')).ApiUsagePage,
    }),
  },
  {
    path: 'admin/users',
    lazy: async () => ({
      Component: (await import('../features/me/AdminUsersPage')).AdminUsersPage,
    }),
  },
  {
    path: 'backup',
    lazy: async () => ({
      Component: (await import('../features/backup/BackupPage')).BackupPage,
    }),
  },
  // AI 수집 원자료 점검 — 관리자만 (서버도 관리자만, docs/16 A3)
  {
    path: 'admin/ai',
    lazy: async () => ({
      Component: (await import('../features/dev/DevAiPage')).DevAiPage,
    }),
  },
  // 개발용 화면은 개발 서버에서만 (운영 빌드에는 경로 자체가 없음)
  ...(import.meta.env.DEV
    ? [
        {
          path: 'dev/ui',
          lazy: async () => {
            const { DevUiPage } = await import('../features/dev/DevUiPage');
            return { Component: DevUiPage };
          },
        },
        {
          path: 'dev/db',
          lazy: async () => {
            const { DevDbPage } = await import('../features/dev/DevDbPage');
            return { Component: DevDbPage };
          },
        },
      ]
    : []),
  { path: '*', element: <NotFoundPage /> },
];

/** 로그인 없이 여는 화면: 로그인, 법적 고지, 보기 전용 링크, 초대 수락(그 안에서 로그인 안내), 없는 주소 */
const PUBLIC = new Set(['login', 'legal/:doc', 's/:shareId', 'invite/:token', '*']);
const isPublic = (r: RouteObject) => r.path !== undefined && PUBLIC.has(r.path);

export const routes: RouteObject[] = [
  { element: <AuthGate />, children: allRoutes.filter((r) => !isPublic(r)) },
  ...allRoutes.filter(isPublic),
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
