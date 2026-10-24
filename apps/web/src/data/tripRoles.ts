import type { TripRole } from '@trippocket/shared';
import { create } from 'zustand';

/**
 * 공유받은 여행에서 내 역할 (동기화 pull이 알려 줌). 보기 전용(viewer)이면 이 기기에서도 고치지 못하게 한다:
 * - 화면: useCanEdit(tripId)로 추가·수정·삭제 버튼을 숨김
 * - 저장소: db.ts의 쓰기 확인(assertEditable)이 마지막으로 막음 → ReadOnlyTripError
 * 서버에 없는 여행(이 기기에서 만든 것)은 목록에 없으므로 고칠 수 있다.
 * 이 기기에만 저장 (비밀값 아님, 서버가 다시 확인함)
 */
const KEY = 'tp-trip-roles';

function load(): Record<string, TripRole> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return typeof v === 'object' && v !== null ? (v as Record<string, TripRole>) : {};
  } catch {
    return {};
  }
}

const useRoles = create<Record<string, TripRole>>(load);

/** 여행별 멤버 수 (나 포함). 이 기기에 저장 */
const COUNT_KEY = 'tp-trip-members';
function loadCounts(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(COUNT_KEY) ?? '{}') as unknown;
    return typeof v === 'object' && v !== null ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}
const useCounts = create<Record<string, number>>(loadCounts);
export function setMemberCounts(counts: Record<string, number>): void {
  useCounts.setState(counts, true);
  try {
    localStorage.setItem(COUNT_KEY, JSON.stringify(counts));
  } catch {
    // 저장 못 해도 이번 실행에서는 적용
  }
}
/** 멤버 수 (나 포함). 공유하지 않은 여행이면 1 */
export const useMemberCount = (tripId: string | undefined): number =>
  useCounts((s) => (tripId ? (s[tripId] ?? 1) : 1));

/** pull 때마다 서버의 지금 멤버십으로 바꾼다 */
export function setTripRoles(roles: Record<string, TripRole>): void {
  useRoles.setState(roles, true);
  try {
    localStorage.setItem(KEY, JSON.stringify(roles));
  } catch {
    // 저장 못 해도 이번 실행에서는 적용
  }
}

export const tripRole = (tripId: string): TripRole | undefined => useRoles.getState()[tripId];
export const canEditTrip = (tripId: string | undefined): boolean =>
  !tripId || tripRole(tripId) !== 'viewer';
/** 내 역할 (공유받은 여행이 아니면 없음) */
export const useTripRole = (tripId: string | undefined): TripRole | undefined =>
  useRoles((s) => (tripId ? s[tripId] : undefined));
export const useCanEdit = (tripId: string | undefined): boolean =>
  useRoles((s) => !tripId || s[tripId] !== 'viewer');

/** 보기 전용 여행을 이 기기에서 고치려 함 */
export class ReadOnlyTripError extends Error {
  constructor(readonly tripId: string) {
    super(`read_only_trip:${tripId}`);
  }
}

export function assertEditable(tripId: string | undefined): void {
  if (!canEditTrip(tripId)) throw new ReadOnlyTripError(tripId!);
}
