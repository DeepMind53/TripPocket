import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { BookingsPage } from '../features/bookings/BookingsPage';
import { ChecklistPage } from '../features/checklist/ChecklistPage';
import { HomePage } from '../features/home/HomePage';
import { PlanPage } from '../features/itinerary/PlanPage';
import { MePage } from '../features/me/MePage';
import { PlacesPage } from '../features/places/PlacesPage';
import { SavedPage } from '../features/saved/SavedPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TripsPage } from '../features/trips/TripsPage';
import { AppShell } from './layouts/AppShell';
import { TripLayout } from './layouts/TripLayout';
import { NotFoundPage } from './NotFoundPage';

// 라우트 표: docs/03-architecture.md §6
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'trips', element: <TripsPage /> },
      { path: 'saved', element: <SavedPage /> },
      { path: 'me', element: <MePage /> },
    ],
  },
  {
    path: 'trips/:tripId',
    element: <TripLayout />,
    children: [
      { index: true, element: <Navigate to="plan" replace /> },
      { path: 'plan', element: <PlanPage /> },
      { path: 'places', element: <PlacesPage /> },
      { path: 'bookings', element: <BookingsPage /> },
      { path: 'checklist', element: <ChecklistPage /> },
    ],
  },
  { path: 'settings', element: <SettingsPage /> },
  {
    path: 'dev/ui',
    lazy: async () => {
      const { DevUiPage } = await import('../features/dev/DevUiPage');
      return { Component: DevUiPage };
    },
  },
  { path: '*', element: <NotFoundPage /> },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
