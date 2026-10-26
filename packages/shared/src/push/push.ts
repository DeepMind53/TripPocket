/** 알림 종류 — 기기마다 켜고 끈다 (docs/20 G1, 웹·서버 공용). 새 종류는 여기만 고친다 */
export const PUSH_KINDS = ['departure', 'entry', 'itemSoon', 'sharing', 'alert'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export type PushPrefs = Record<PushKind, boolean>;
export const DEFAULT_PUSH_PREFS: PushPrefs = {
  departure: true,
  entry: true,
  itemSoon: true,
  sharing: true,
  alert: true,
};
