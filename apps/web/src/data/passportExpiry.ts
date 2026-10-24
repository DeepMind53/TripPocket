import { create } from 'zustand';
import type { LocalDate } from '@trippocket/shared';

/**
 * 여권 만료일 — 이 기기에만 (동기화·서버·백업 안 함, docs/19 §4 개인정보 최소화).
 * 나라별 필수 항목에서 "귀국일 + N개월" 판단에만 쓴다
 */
const KEY = 'tp-passport-expiry';

function load(): LocalDate | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export const usePassportExpiry = create<{ value: LocalDate | null }>(() => ({ value: load() }));

export function setPassportExpiry(value: LocalDate | null): void {
  usePassportExpiry.setState({ value });
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // 저장 못 해도 이번 실행에서는 판단에 씀
  }
}
