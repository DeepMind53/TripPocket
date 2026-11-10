/** 여행 모드 아래 탭으로 여는 화면 (사용자 요청 2026-11-10 — 화면을 옮기지 않고 내용만) */
export const TRAVEL_TABS = [
  'weather',
  'checklist',
  'bookings',
  'fx',
  'phrases',
  'essentials',
] as const;
export type TravelTabId = (typeof TRAVEL_TABS)[number];

export const isTravelTab = (v: string | null): v is TravelTabId =>
  (TRAVEL_TABS as readonly (string | null)[]).includes(v);
