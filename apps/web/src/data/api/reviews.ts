import type { ReviewInput, ReviewSummary, ReviewView } from '@trippocket/shared';
import { api } from './client';

/** 후기·포인트 (서버 routes/reviews.ts, docs/17) */
export interface ItemReviews {
  reviews: ReviewView[];
  summary: ReviewSummary;
  mine: ReviewView | null;
}
export interface PointHistory {
  balance: number;
  history: { delta: number; reason: string; placeName: string | null; createdAt: string }[];
}

export const reviewsApi = {
  forItem: (tripId: string, itemId: string, placeKey: string | null) =>
    api<ItemReviews>(
      `/api/reviews?${new URLSearchParams({ trip: tripId, item: itemId, ...(placeKey ? { place: placeKey } : {}) })}`,
    ),
  save: (input: ReviewInput) =>
    api<{ review: ReviewView; pointsAwarded: number; balance: number }>('/api/reviews', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    api<{ ok: true; balance: number }>(`/api/reviews/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  mine: () =>
    api<{ reviews: (ReviewView & { tripId: string; itemId: string })[] }>('/api/reviews/mine'),
  points: () => api<PointHistory>('/api/me/points'),
  setHideNickname: (hideNickname: boolean) =>
    api<{ hideNickname: boolean }>('/api/me/privacy', {
      method: 'PATCH',
      body: JSON.stringify({ hideNickname }),
    }),
};
