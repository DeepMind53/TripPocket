import type { LodgingReportInput, LodgingReportView } from '@trippocket/shared';
import { api, type ApiResult } from './client';

/**
 * 숙소 가격 기록 (서버 routes/lodging.ts, docs/28 §7) — 요청 방어는 data/lodgingReports.ts가 맡는다.
 * 여기서 바로 부르지 말고 그쪽을 쓴다
 */
export interface ReportQuery {
  hotelKey: string;
  altKey?: string | undefined;
  checkIn: string;
  nights: number;
  adults: number;
}

export const lodgingApi = {
  list: (
    q: ReportQuery,
    signal: AbortSignal,
  ): Promise<ApiResult<{ reports: LodgingReportView[] }>> =>
    api(
      `/api/lodging/reports?${new URLSearchParams({
        hotelKey: q.hotelKey,
        ...(q.altKey && q.altKey !== q.hotelKey ? { altKey: q.altKey } : {}),
        checkIn: q.checkIn,
        nights: String(q.nights),
        adults: String(q.adults),
      })}`,
      { signal },
    ),
  save: (input: LodgingReportInput, signal: AbortSignal) =>
    api<{ report: LodgingReportView }>('/api/lodging/reports', {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    }),
  remove: (id: string, signal: AbortSignal) =>
    api<{ ok: true }>(`/api/lodging/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      signal,
    }),
};
