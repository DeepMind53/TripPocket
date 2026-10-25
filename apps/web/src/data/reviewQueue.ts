import type { ReviewInput } from '@trippocket/shared';
import { reviewsApi } from './api/reviews';
import { useAuth } from './authStore';

/**
 * 오프라인에서 쓴 후기 (docs/17 §6): 이 기기에 두었다가 동기화가 끝나면 올린다
 * (일정이 서버에 있어야 후기를 받으므로 동기화 뒤). 같은 일정은 마지막 것만
 */
const KEY = 'tp-review-queue';

export function queuedReviews(): ReviewInput[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? (v as ReviewInput[]) : [];
  } catch {
    return [];
  }
}

function write(list: ReviewInput[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // 저장 못 하면 이번 실행 동안만
  }
}

export function queueReview(input: ReviewInput): void {
  write([...queuedReviews().filter((r) => r.itemId !== input.itemId), input]);
}

export const queuedFor = (itemId: string) => queuedReviews().find((r) => r.itemId === itemId);

/** 대기 중인 후기 올리기 — 올렸거나 다시 올려도 안 되는 것(400·403·404·422)은 뺀다 */
export async function flushReviewQueue(): Promise<number> {
  const list = queuedReviews();
  if (!list.length) return 0;
  let points = 0;
  const left: ReviewInput[] = [];
  for (const r of list) {
    const res = await reviewsApi.save(r);
    if (res.ok) points += res.data.pointsAwarded;
    else if (
      res.reason === 'offline' ||
      res.reason === 'limit' ||
      res.status === 409 ||
      res.status === 429
    )
      left.push(r);
  }
  write(left);
  if (points) {
    const me = useAuth.getState().me;
    if (me) useAuth.setState({ me: { ...me, points: (me.points ?? 0) + points } });
  }
  return points;
}

/** 기기 데이터 정리: 올리기 대기 중인 후기 모두 지우기 */
export function clearReviewQueue(): void {
  write([]);
}
