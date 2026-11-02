import { api } from './api/client';
import {
  countUse,
  loadUsage as load,
  saveUsage as save,
  usageToday as today,
} from '../shared/lib/usageCount';

export { countUse, screenName } from '../shared/lib/usageCount';

/**
 * 사용 통계 (ADR-0009): 기능을 쓴 횟수만 기기에 모았다가 동기화할 때 보낸다.
 * 이름은 정해진 영문 이름뿐 — 입력 내용·장소·위치·id는 넣지 않는다 (화면 경로의 id는 :id로 바꿈).
 * 서버는 누가 보냈는지 저장하지 않는다. 저장 못 하는 환경이면 세지 않는다
 */
const ENV_KEY = 'tp-usage-env';

/** 기기 환경: 하루 한 번 (기기 수 기준 비율) */
function countEnv(extra: Record<string, boolean>): void {
  try {
    if (localStorage.getItem(ENV_KEY) === today()) return;
    localStorage.setItem(ENV_KEY, today());
  } catch {
    return;
  }
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua)
    ? 'ios'
    : /Android/.test(ua)
      ? 'android'
      : /Windows/.test(ua)
        ? 'windows'
        : /Mac/.test(ua)
          ? 'mac'
          : 'other';
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  countUse('env.devices');
  countUse(`env.os.${os}`);
  countUse(`env.installed.${standalone ? 'yes' : 'no'}`);
  for (const [k, on] of Object.entries(extra)) if (on) countUse(`env.${k}`);
}

let sending = false;

/** 모은 횟수 보내기 (동기화가 끝난 뒤). 실패하면 다음에 다시 */
export async function flushUsage(extraEnv: Record<string, boolean> = {}): Promise<void> {
  if (sending) return;
  countEnv(extraEnv);
  const c = load();
  const dates = Object.keys(c).sort().slice(-8);
  if (dates.length === 0) return;
  sending = true;
  try {
    const days = Object.fromEntries(dates.map((d) => [d, c[d]!]));
    const res = await api('/api/stats/events', {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
    // 보낸 동안 더 센 것은 남긴다. 8일보다 오래된 것은 서버도 받지 않으므로 버린다
    if (!res.ok) return;
    const now = load();
    for (const d of dates) {
      const day = now[d];
      if (!day) continue;
      for (const [k, v] of Object.entries(days[d]!)) {
        const left = (day[k] ?? 0) - v;
        if (left > 0) day[k] = left;
        else delete day[k];
      }
      if (Object.keys(day).length === 0) delete now[d];
    }
    for (const d of Object.keys(now)) if (d < dates[0]!) delete now[d];
    save(now);
  } finally {
    sending = false;
  }
}
