import type { Transaction } from 'dexie';

/**
 * v1 → v2: Trip.destinations 가 문자열 배열이던 것을 객체 배열로.
 * 예전 이름은 좌표·국가를 모르므로 kind: 'custom' (여행 설정에서 다시 고를 수 있다).
 * 도시 데이터(검색용)는 첫 화면 크기 때문에 여기서 불러오지 않는다.
 */
export async function upgradeToV2(tx: Transaction): Promise<void> {
  await tx
    .table('trips')
    .toCollection()
    .modify((trip: { destinations?: unknown[]; dirty?: number }) => {
      const list = Array.isArray(trip.destinations) ? trip.destinations : [];
      trip.destinations = list.map((d) =>
        typeof d === 'string' ? { name: d.trim() || '?', kind: 'custom' } : d,
      );
      trip.dirty = 1;
    });
}
