import {
  ALLERGENS,
  BLOOD_TYPES,
  ENTRY_PERMITS,
  type Allergen,
  type BloodType,
  type EntryPermit,
  type LocalDate,
} from '@trippocket/shared';
import { create } from 'zustand';

/**
 * 마이 → 개인정보 (사용자 요청 2026-10-27, 항목 추가 2026-11-02): 여행에 필요한 정보.
 * 이 기기에만 저장한다 (동기화·서버·백업 안 함 — docs/19 §4 개인정보 최소화). 여권 번호 같은 민감 정보는 받지 않는다
 */
export interface Membership {
  /** 항공사 이름 또는 코드 ("대한항공", "KE") — 예약의 항공사·편명과 맞춘다 */
  airline: string;
  number: string;
  tier: string;
}
export interface EmergencyContact {
  name: string;
  phone: string;
}

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
  /** 전자여행허가 만료일 (ESTA 등) — 필수 항목 "비자" 줄 자동 판단 */
  permits: Partial<Record<EntryPermit, LocalDate>>;
  /** 항공사 회원번호·등급 — 항공 예약 카드에 보여 줌 */
  memberships: Membership[];
  /** 여행자 보험 — 긴급 연락처 화면 */
  insurance: { company: string; policyNo: string; phone: string };
  /** 비상 연락처 (가족 등) — 긴급 연락처 화면 */
  contacts: EmergencyContact[];
  /** 알레르기·혈액형·복용약 — 현지어 건강 카드 (회화 화면) */
  allergens: Allergen[];
  bloodType: BloodType | null;
  meds: string;
}

const KEY = 'tp-travel-profile';
/** 예전 여권 만료일 저장 키 (2026-10-25) — 처음 읽을 때 옮긴다 */
const OLD_PASSPORT_KEY = 'tp-passport-expiry';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MEMBERSHIPS_MAX = 10;
export const CONTACTS_MAX = 3;

const EMPTY: TravelProfile = {
  passportExpiry: null,
  licenseExpiry: null,
  seat: 'any',
  food: '',
  memo: '',
  permits: {},
  memberships: [],
  insurance: { company: '', policyNo: '', phone: '' },
  contacts: [],
  allergens: [],
  bloodType: null,
  meds: '',
};

/** 저장된 값(무엇이든) → 올바른 개인정보. 틀린 항목은 빈 값 */
export function parseProfile(raw: unknown): TravelProfile {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const date = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : null);
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const obj = (v: unknown) => (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);
  const permitsRaw = obj(o.permits);
  const ins = obj(o.insurance);
  return {
    passportExpiry: date(o.passportExpiry),
    licenseExpiry: date(o.licenseExpiry),
    seat: o.seat === 'window' || o.seat === 'aisle' ? o.seat : 'any',
    food: text(o.food, 200),
    memo: text(o.memo, 500),
    permits: Object.fromEntries(
      ENTRY_PERMITS.flatMap((k) => {
        const d = date(permitsRaw[k]);
        return d ? [[k, d]] : [];
      }),
    ),
    memberships: arr(o.memberships)
      .slice(0, MEMBERSHIPS_MAX)
      .map((m) => ({
        airline: text(obj(m).airline, 40),
        number: text(obj(m).number, 30),
        tier: text(obj(m).tier, 30),
      })),
    insurance: {
      company: text(ins.company, 40),
      policyNo: text(ins.policyNo, 40),
      phone: text(ins.phone, 30),
    },
    contacts: arr(o.contacts)
      .slice(0, CONTACTS_MAX)
      .map((c) => ({ name: text(obj(c).name, 30), phone: text(obj(c).phone, 30) })),
    allergens: arr(o.allergens).filter((a): a is Allergen =>
      (ALLERGENS as readonly unknown[]).includes(a),
    ),
    bloodType: (BLOOD_TYPES as readonly unknown[]).includes(o.bloodType)
      ? (o.bloodType as BloodType)
      : null,
    meds: text(o.meds, 200),
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

/** 예약의 항공사·편명에 맞는 회원번호 ("대한항공" ↔ "대한항공", "KE" ↔ 편명 "KE703") */
export function membershipFor(
  list: readonly Membership[],
  booking: { provider?: string | undefined; flightNo?: string | undefined },
): Membership | undefined {
  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const provider = norm(booking.provider ?? '');
  const flight = norm(booking.flightNo ?? '');
  return list.find((m) => {
    const a = norm(m.airline);
    if (!a || !m.number) return false;
    if (provider && (provider.includes(a) || a.includes(provider))) return true;
    return /^[a-z0-9]{2}$/.test(a) && flight.startsWith(a);
  });
}
