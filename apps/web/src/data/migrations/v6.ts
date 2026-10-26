import type { Transaction } from 'dexie';

/**
 * v5 → v6 (2026-10-26): 일정에 방문 기록(visit) 추가. 이미 "다녀옴"(done)인 일정은 방문으로 옮겨 적는다.
 * 기기마다 같은 규칙으로 바뀌므로 동기화 대상으로 표시하지 않는다(dirty 그대로)
 */
export async function upgradeToV6(tx: Transaction): Promise<void> {
  await tx
    .table('items')
    .toCollection()
    .modify((item: { done?: boolean; visit?: string }) => {
      if (item.done === true && item.visit === undefined) item.visit = 'visited';
    });
}
