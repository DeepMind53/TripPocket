import { reportLimit } from '../limitNotice';
/**
 * 홈 서버 API (같은 주소의 /api — Cloudflare Pages가 홈 서버로 전달, ADR-0006).
 * 서버가 없거나 꺼져 있어도 앱은 로컬로 동작 → 오류 대신 결과 종류로 돌려준다
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'unauthorized' | 'offline' | 'error' | 'limit'; status: number };

export async function api<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    return { ok: false, reason: 'offline', status: 0 };
  }
  // 서버가 없으면 개발 서버·Pages가 앱 HTML을 돌려준다 → 서버 없음으로
  const isJson = res.headers.get('content-type')?.includes('json') ?? false;
  if (res.ok && isJson) return { ok: true, data: (await res.json()) as T };
  if (res.ok) return { ok: false, reason: 'offline', status: res.status };
  if (res.status === 401) return { ok: false, reason: 'unauthorized', status: 401 };
  // 사용량 한도(503 api_paused·429 daily_limit) → 이유를 팝업으로 (data/limitNotice.ts)
  if (isJson && (res.status === 429 || res.status === 503)) {
    const body: unknown = await res.json().catch(() => null);
    if (reportLimit(body)) return { ok: false, reason: 'limit', status: res.status };
  }
  // 502 = 홈 PC 꺼짐, 503 = 서버 아직 연결 안 함, 404(HTML) = 개발 중 서버 없음
  if ([0, 404, 502, 503, 504].includes(res.status))
    return { ok: false, reason: 'offline', status: res.status };
  return { ok: false, reason: 'error', status: res.status };
}
