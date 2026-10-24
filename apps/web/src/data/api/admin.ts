import { api } from './client';

/** 사용자 관리 API — 관리자만 (서버 routes/admin.ts) */
export interface JoinRequest {
  id: string;
  provider: string;
  nickname: string;
  status: 'pending' | 'rejected';
  requestedAt: string;
}
export interface ManagedUser {
  id: string;
  nickname: string;
  status: 'active' | 'disabled';
  isAdmin: boolean;
  createdAt: string;
  providers: string[];
  lastSeenAt: string | null;
}

const enc = encodeURIComponent;
const post = (path: string) => api(path, { method: 'POST' });

export const adminApi = {
  list: () => api<{ requests: JoinRequest[]; users: ManagedUser[] }>('/api/admin/users'),
  approve: (id: string) => post(`/api/admin/requests/${enc(id)}/approve`),
  reject: (id: string) => post(`/api/admin/requests/${enc(id)}/reject`),
  disable: (userId: string) => post(`/api/admin/users/${enc(userId)}/disable`),
  enable: (userId: string) => post(`/api/admin/users/${enc(userId)}/enable`),
};

/** API 사용량 (서버 services/apiUsage.ts) */
export interface ApiUsage {
  id: string;
  group: 'paid' | 'free';
  freeMonthly: number | null;
  freeDaily: number | null;
  /** 이번 달 자동 중지 상한 */
  autoLimit: number | null;
  /** 오늘 자동 중지 상한 */
  dailyLimit: number | null;
  used: number;
  today: number;
  daily: { date: string; count: number }[];
  paused: boolean;
  /** false = 수동 중지 불가 (로그인·프록시) */
  pausable: boolean;
  browser: boolean;
  autoStopped: boolean;
  autoStoppedBy: 'month' | 'day' | null;
}
export interface ApiUsageReport {
  month: string;
  apis: ApiUsage[];
}

export const apiUsageApi = {
  report: () => api<ApiUsageReport>('/api/admin/api-usage'),
  update: (
    id: string,
    body: { paused?: boolean; limit?: number | null; dailyLimit?: number | null },
  ) =>
    api<ApiUsageReport>(`/api/admin/api-usage/${enc(id)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
