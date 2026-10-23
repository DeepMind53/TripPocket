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
  accept: (token: string) =>
    api<{ tripId: string; role: string }>(`/api/invites/${enc(token)}/accept`, {
      method: 'POST',
      body: '{}',
    }),
  members: (tripId: string) => api<{ members: Member[] }>(`/api/trips/${enc(tripId)}/members`),
  setRole: (tripId: string, userId: string, role: 'editor' | 'viewer') =>
    api(`/api/trips/${enc(tripId)}/members/${enc(userId)}`, { method: 'PATCH', ...json({ role }) }),
  remove: (tripId: string, userId: string) =>
    api(`/api/trips/${enc(tripId)}/members/${enc(userId)}`, { method: 'DELETE' }),
};

export const shareUrl = (shareId: string) => `${window.location.origin}/s/${shareId}`;
export const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;
