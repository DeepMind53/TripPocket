import { api } from './client';

/** 사용자 관리 API — 관리자만 (서버 routes/admin.ts) */
export interface JoinRequest {
  id: string;
  provider: string;
  nickname: string;
  /** 가입 대기 화면에서 남긴 말 (승인·거절하면 지움) */
  note?: string;
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
  /** 거절한 요청을 목록에서 지우기 */
  remove: (id: string) => api(`/api/admin/requests/${enc(id)}`, { method: 'DELETE' }),
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
  /** 월 무료량을 함께 쓰는 묶음 id (예: kakao_map) */
  pool: string | null;
  poolOnly: boolean;
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

/** 사용 통계 (서버 routes/stats.ts, 관리자만) — 사람 구분 없는 합계 */
export interface StatRow {
  name: string;
  n: number;
}
export interface StatsReport {
  days: number;
  since: string;
  today: string;
  users: {
    total: number;
    active1: number;
    active7: number;
    active30: number;
    daily: { date: string; n: number }[];
    signups: { date: string; n: number }[];
    providers: StatRow[];
    retention7: { base: number; back: number };
    retention30: { base: number; back: number };
    activeDays: StatRow[];
    hours: StatRow[];
  };
  events: StatRow[];
  /** 기능을 쓴 기기 수 (기기마다 하루 한 번) */
  reach: StatRow[];
  search: StatRow[];
  env: StatRow[];
  data: StatRow[];
  sync: StatRow[];
  ai: StatRow[];
  api: {
    route: string;
    n: number;
    e4: number;
    e5: number;
    limit: number;
    p50: number | null;
    p95: number | null;
  }[];
  trips: {
    total: number;
    domestic: number;
    countries: StatRow[];
    cities: StatRow[];
    avgDays: number;
    perTrip: { items: number; bookings: number; checklistItems: number };
    shared: number;
  };
  settings: {
    users: number;
    features: StatRow[];
    domesticMap: StatRow[];
    prompt: { seen: number; on: number };
  };
  devices: { sessions: number; os: StatRow[]; browser: StatRow[] };
}

export const statsApi = {
  report: (days: number) => api<StatsReport>(`/api/admin/stats?days=${days}`),
};
