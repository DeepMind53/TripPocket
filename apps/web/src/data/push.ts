import { DEFAULT_PUSH_PREFS, PUSH_KINDS, type PushKind, type PushPrefs } from '@trippocket/shared';
import { create } from 'zustand';
import { api } from './api/client';

export { PUSH_KINDS, type PushKind, type PushPrefs };
const DEFAULT: PushPrefs = DEFAULT_PUSH_PREFS;

/** 이 기기의 알림 상태 (켜짐·종류) — 기기마다 따로, 서버에는 구독과 함께 저장 */
const KEY = 'tp-push';
interface State {
  enabled: boolean;
  prefs: PushPrefs;
}
function load(): State {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<State> | null;
    return { enabled: v?.enabled === true, prefs: { ...DEFAULT, ...(v?.prefs ?? {}) } };
  } catch {
    return { enabled: false, prefs: DEFAULT };
  }
}
export const usePush = create<State>(load);
function save(s: State) {
  usePush.setState(s);
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 기억 못 해도 이번 실행에는 적용
  }
}

/** 이 브라우저가 알림을 받을 수 있나 (아이폰은 홈 화면에 추가한 앱에서만) */
export function pushSupport(): 'ok' | 'ios-install' | 'unsupported' | 'denied' {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  )
    return /iPhone|iPad/.test(navigator.userAgent) ? 'ios-install' : 'unsupported';
  if (!('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

const b64 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function subscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  const cur = await reg.pushManager.getSubscription();
  if (cur || !create) return cur;
  const key = await api<{ key: string }>('/api/push/key');
  if (!key.ok) return null;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64(key.data.key),
  });
}

async function upload(sub: PushSubscription, prefs: PushPrefs): Promise<boolean> {
  const j = sub.toJSON();
  const res = await api('/api/push/subscription', {
    method: 'PUT',
    body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys, prefs }),
  });
  return res.ok;
}

/** 전체 켜기: 권한 묻기 → 구독 → 서버에 등록. 실패 이유를 돌려준다 */
export async function enablePush(): Promise<'ok' | 'denied' | 'failed'> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const sub = await subscription(true);
    if (!sub || !(await upload(sub, usePush.getState().prefs))) return 'failed';
    save({ ...usePush.getState(), enabled: true });
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** 전체 끄기: 구독 해제 + 서버에서 지움 */
export async function disablePush(): Promise<void> {
  save({ ...usePush.getState(), enabled: false });
  try {
    const sub = await subscription(false);
    if (!sub) return;
    await api('/api/push/subscription', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch {
    // 오프라인이면 다음에 켤 때 덮어씀
  }
}

/** 종류 하나 켜고 끄기 (필요한 것만) */
export async function setPushKind(kind: PushKind, on: boolean): Promise<void> {
  const next = { ...usePush.getState(), prefs: { ...usePush.getState().prefs, [kind]: on } };
  save(next);
  if (!next.enabled) return;
  try {
    const sub = await subscription(false);
    if (sub) await upload(sub, next.prefs);
  } catch {
    // 다음에 켤 때 맞춘다
  }
}

/**
 * 나갈 시각 알림 (ADR-0013, 실험실 leavePush): 여행 모드가 계산한 "HH:mm"만 서버에 — 좌표·이동 시간은 보내지 않는다.
 * 같은 일정·같은 시각은 다시 보내지 않는다 (이 실행 동안)
 */
const sentLeave = new Map<string, string>();
export async function sendLeaveTime(v: {
  tripId: string;
  itemId: string;
  date: string;
  leaveAt: string;
}): Promise<void> {
  const s = usePush.getState();
  if (!s.enabled || !s.prefs.itemSoon) return;
  if (sentLeave.get(v.itemId) === `${v.date} ${v.leaveAt}`) return;
  const res = await api('/api/push/leave', { method: 'PUT', body: JSON.stringify(v) });
  if (res.ok) sentLeave.set(v.itemId, `${v.date} ${v.leaveAt}`);
}
