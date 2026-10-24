import { create } from 'zustand';
import { api } from './api/client';
import { db } from './db';

export interface Me {
  id: string;
  nickname: string;
  createdAt: string;
  providers: string[];
  /** 첫 계정 = 관리자 (사용자 관리 메뉴) */
  isAdmin?: boolean;
  /** false = 아직 닉네임을 직접 정하지 않음 (로그인 서비스 이름) → 정하기 시트 */
  nicknameSet?: boolean;
  /** 후기 (docs/17): 가린 이름 번호(User#N)·닉네임 가리기·포인트 잔액 */
  publicNo?: number;
  hideNickname?: boolean;
  points?: number;
}

export interface DeviceSession {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
  current: boolean;
}

type Status = 'unknown' | 'anon' | 'user' | 'offline';

/** 로그인 상태. 로그인한 사람만 앱을 쓴다 (app/AuthGate.tsx) */
export const useAuth = create<{ status: Status; me: Me | null }>(() => ({
  status: 'unknown',
  me: null,
}));

/** 이 기기에서 로그인한 적 있음 (오프라인일 때도 앱을 열기 위해 — 비밀값 아님) */
const SIGNED_IN_KEY = 'tp-signed-in';
export function wasSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}
useAuth.subscribe((s) => {
  try {
    if (s.status === 'user') localStorage.setItem(SIGNED_IN_KEY, '1');
    else if (s.status === 'anon') localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // 저장 못 하면 오프라인일 때 로그인 화면이 보일 뿐
  }
});

export async function refreshMe(): Promise<void> {
  const res = await api<Me>('/api/me');
  if (res.ok) useAuth.setState({ status: 'user', me: res.data });
  else useAuth.setState({ status: res.reason === 'unauthorized' ? 'anon' : 'offline', me: null });
}

/** 로그아웃. wipe = 이 기기의 여행 데이터도 지움 (공용 기기, docs/09 §6.3) */
export async function logout(wipe: boolean): Promise<void> {
  await api('/auth/logout', { method: 'POST', body: '{}' });
  // 기기 저장소 비우기 (data/dev의 resetLocalDb와 같음 — 샘플 여행 코드를 첫 화면에 싣지 않으려고 직접)
  if (wipe) {
    await db.delete();
    await db.open();
  }
  // 다음 로그인 때 "이 기기 데이터를 올릴까요?"를 다시 묻도록
  else await db.syncState.clear();
  useAuth.setState({ status: 'anon', me: null });
}

export async function deleteAccount(): Promise<boolean> {
  const res = await api('/api/me', { method: 'DELETE' });
  if (res.ok) useAuth.setState({ status: 'anon', me: null });
  return res.ok;
}

/** 닉네임 바꾸기 (서버가 다시 검사) */
export async function updateNickname(nickname: string): Promise<boolean> {
  const res = await api<{ nickname: string }>('/api/me/nickname', {
    method: 'PATCH',
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) return false;
  useAuth.setState((s) =>
    s.me ? { me: { ...s.me, nickname: res.data.nickname, nicknameSet: true } } : s,
  );
  return true;
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
