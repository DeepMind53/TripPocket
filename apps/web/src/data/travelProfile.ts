import type { LocalDate } from '@trippocket/shared';
import { create } from 'zustand';

/**
 * 마이 → 개인정보 (사용자 요청 2026-10-27): 여행에 필요하지만 신상·보안과 관련 없는 정보.
 * 이 기기에만 저장한다 (동기화·서버·백업 안 함 — docs/19 §4 개인정보 최소화). 여권 번호 같은 민감 정보는 받지 않는다
 */
export interface TravelProfile {
  /** 여권 만료일 — 나라별 필수 항목의 "귀국일 + N개월" 자동 판단 */
  passportExpiry: LocalDate | null;
  /** 국제운전면허증 만료일 (렌터카) */
  licenseExpiry: LocalDate | null;
  /** 비행기 선호 좌석 */
  seat: 'window' | 'aisle' | 'any';
  /** 못 먹는 음식·알레르기 (식당 예약·주문 때 보기) */
  food: string;
  /** 그 밖에 여행 때 자주 보는 메모 */
  memo: string;
}

const KEY = 'tp-travel-profile';
/** 예전 여권 만료일 저장 키 (2026-10-25) — 처음 읽을 때 옮긴다 */
const OLD_PASSPORT_KEY = 'tp-passport-expiry';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const EMPTY: TravelProfile = {
  passportExpiry: null,
  licenseExpiry: null,
  seat: 'any',
  food: '',
  memo: '',
};

/** 저장된 값(무엇이든) → 올바른 개인정보. 틀린 항목은 빈 값 */
export function parseProfile(raw: unknown): TravelProfile {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const date = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : null);
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    passportExpiry: date(o.passportExpiry),
    licenseExpiry: date(o.licenseExpiry),
    seat: o.seat === 'window' || o.seat === 'aisle' ? o.seat : 'any',
    food: text(o.food, 200),
    memo: text(o.memo, 500),
  };
}

function load(): TravelProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseProfile(JSON.parse(raw));
    const old = localStorage.getItem(OLD_PASSPORT_KEY);
    return { ...EMPTY, passportExpiry: old && DATE.test(old) ? old : null };
  } catch {
    return EMPTY;
  }
}

export const useTravelProfile = create<TravelProfile>(load);

export function updateTravelProfile(patch: Partial<TravelProfile>): void {
  useTravelProfile.setState(patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(useTravelProfile.getState()));
    localStorage.removeItem(OLD_PASSPORT_KEY);
  } catch {
    // 저장 못 해도 이번 실행에서는 쓴다
  }
}
