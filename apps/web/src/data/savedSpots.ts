import type { LocalDate } from '@trippocket/shared';
import { create } from 'zustand';

/**
 * 빠른 메뉴 "현재 위치 저장" (사용자 요청 2026-11-02): 여행 중 주차한 곳·숙소 골목처럼 다시 찾아갈 위치.
 * 이 기기에만 저장한다 — 서버·백업으로 보내지 않는다 (CLAUDE.md: 사용자 위치를 서버에 저장하지 않음, 사용자 결정 2026-11-02).
 * 저장한 여행(tripId)과 함께 두고, 다른 여행이 시작되면(그 여행 시작일 이후) 목록을 자동으로 지운다
 */
export interface SavedSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 저장한 시각 (ISO) */
  savedAt: string;
}
interface State {
  tripId: string | null;
  spots: SavedSpot[];
}

const KEY = 'tp-saved-spots';
export const SPOTS_MAX = 50;

function load(): State {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as State | null;
    return v && Array.isArray(v.spots) ? v : { tripId: null, spots: [] };
  } catch {
    return { tripId: null, spots: [] };
  }
}
function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(useSavedSpots.getState()));
  } catch {
    // 저장 못 해도 이번 실행에서는 보인다
  }
}

export const useSavedSpots = create<State>(load);

/**
 * 지금 보는 여행 기준으로 목록 정리: 다른 여행이 이미 시작됐으면(오늘 ≥ 그 여행 시작일) 예전 여행 위치는 지운다.
 * 아직 시작 전인 다른 여행을 열어 본 것만으로는 지우지 않는다
 */
export function syncSpotsTrip(trip: { id: string; startDate: LocalDate }, today: LocalDate): void {
  const s = useSavedSpots.getState();
  if (s.tripId === trip.id || today < trip.startDate) return;
  useSavedSpots.setState({ tripId: trip.id, spots: [] });
  persist();
}

export function addSpot(tripId: string, spot: Omit<SavedSpot, 'id' | 'savedAt'>): void {
  const s = useSavedSpots.getState();
  const spots = s.tripId === tripId ? s.spots : [];
  useSavedSpots.setState({
    tripId,
    spots: [
      { ...spot, id: crypto.randomUUID(), savedAt: new Date().toISOString() },
      ...spots,
    ].slice(0, SPOTS_MAX),
  });
  persist();
}

export function removeSpot(id: string): void {
  useSavedSpots.setState((s) => ({ spots: s.spots.filter((x) => x.id !== id) }));
  persist();
}
