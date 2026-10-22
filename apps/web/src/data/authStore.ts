import { create } from 'zustand';
import { api } from './api/client';
import { resetLocalDb } from './dev';

export interface Me {
  id: string;
  nickname: string;
  createdAt: string;
  providers: string[];
}

export interface DeviceSession {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
  current: boolean;
}

type Status = 'unknown' | 'anon' | 'user' | 'offline';

/** 로그인 상태 (로그인 안 해도 앱은 전부 동작 — 서버는 동기화용) */
export const useAuth = create<{ status: Status; me: Me | null }>(() => ({
  status: 'unknown',
  me: null,
}));

export async function refreshMe(): Promise<void> {
  const res = await api<Me>('/api/me');
  if (res.ok) useAuth.setState({ status: 'user', me: res.data });
  else useAuth.setState({ status: res.reason === 'unauthorized' ? 'anon' : 'offline', me: null });
}

/** 로그아웃. wipe = 이 기기의 여행 데이터도 지움 (공용 기기, docs/09 §6.3) */
export async function logout(wipe: boolean): Promise<void> {
  await api('/auth/logout', { method: 'POST', body: '{}' });
  if (wipe) await resetLocalDb();
  useAuth.setState({ status: 'anon', me: null });
}

export async function deleteAccount(): Promise<boolean> {
  const res = await api('/api/me', { method: 'DELETE' });
  if (res.ok) useAuth.setState({ status: 'anon', me: null });
  return res.ok;
}

export async function listSessions(): Promise<DeviceSession[] | null> {
  const res = await api<{ sessions: DeviceSession[] }>('/api/me/sessions');
  return res.ok ? res.data.sessions : null;
}

export async function revokeSession(id: string): Promise<boolean> {
  return (await api(`/api/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })).ok;
}

export async function loginProviders(): Promise<string[] | null> {
  const res = await api<{ providers: string[] }>('/auth/providers');
  return res.ok ? res.data.providers : null;
}
