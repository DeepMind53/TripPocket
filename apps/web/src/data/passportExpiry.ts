import type { LocalDate } from '@trippocket/shared';
import { updateTravelProfile, useTravelProfile } from './travelProfile';

/**
 * 여권 만료일 — 마이 → 개인정보(data/travelProfile.ts)에 함께 저장 (이 기기에만).
 * 나라별 필수 항목에서 "귀국일 + N개월" 판단에 쓴다. 예전 화면 코드와 맞추려고 같은 모양으로 둔다
 */
export const usePassportExpiry = <T>(select: (s: { value: LocalDate | null }) => T): T =>
  useTravelProfile((p) => select({ value: p.passportExpiry }));

export function setPassportExpiry(value: LocalDate | null): void {
  updateTravelProfile({ passportExpiry: value });
}
