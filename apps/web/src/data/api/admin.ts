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
