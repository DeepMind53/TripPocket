import type { PublicTrip } from '@trippocket/shared';
import { api } from './client';

/** 공유·초대·멤버 API (서버 routes/share.ts) */
export interface ShareLink {
  id: string;
  includeSensitive: boolean;
}
export interface Member {
  userId: string;
  nickname: string;
  role: 'owner' | 'editor' | 'viewer';
  me: boolean;
}
/** 초대 링크로 들어와 소유자의 허용을 기다리는 사람 (소유자에게만 보임) */
export interface JoinRequest {
  userId: string;
  nickname: string;
  role: 'editor' | 'viewer';
  requestedAt: string;
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });
const enc = encodeURIComponent;

export const shareApi = {
  get: (tripId: string) => api<{ share: ShareLink | null }>(`/api/trips/${enc(tripId)}/share`),
  create: (tripId: string, includeSensitive: boolean) =>
    api<{ share: ShareLink }>(`/api/trips/${enc(tripId)}/share`, {
      method: 'POST',
      ...json({ includeSensitive }),
    }),
  revoke: (tripId: string) => api(`/api/trips/${enc(tripId)}/share`, { method: 'DELETE' }),
  view: (shareId: string) => api<PublicTrip>(`/api/public/shares/${enc(shareId)}`),
  invite: (tripId: string, role: 'editor' | 'viewer') =>
    api<{ token: string; expiresAt: string }>(`/api/trips/${enc(tripId)}/invites`, {
      method: 'POST',
      ...json({ role }),
    }),
  /** 이미 그만한 권한이 있으면 role만, 아니면 status: 'pending' (소유자가 허용해야 멤버) */
  accept: (token: string) =>
    api<{ tripId: string; role: string; status?: 'pending' }>(`/api/invites/${enc(token)}/accept`, {
      method: 'POST',
      body: '{}',
    }),
  members: (tripId: string) =>
    api<{ members: Member[]; requests?: JoinRequest[] }>(`/api/trips/${enc(tripId)}/members`),
  approve: (tripId: string, userId: string, role: 'editor' | 'viewer') =>
    api<{ ok: true; role: string }>(`/api/trips/${enc(tripId)}/requests/${enc(userId)}/approve`, {
      method: 'POST',
      ...json({ role }),
    }),
  reject: (tripId: string, userId: string) =>
    api(`/api/trips/${enc(tripId)}/requests/${enc(userId)}`, { method: 'DELETE' }),
  setRole: (tripId: string, userId: string, role: 'editor' | 'viewer') =>
    api(`/api/trips/${enc(tripId)}/members/${enc(userId)}`, { method: 'PATCH', ...json({ role }) }),
  remove: (tripId: string, userId: string) =>
    api(`/api/trips/${enc(tripId)}/members/${enc(userId)}`, { method: 'DELETE' }),
};

export const shareUrl = (shareId: string) => `${window.location.origin}/s/${shareId}`;
export const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;
