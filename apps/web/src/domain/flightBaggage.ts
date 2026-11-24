/**
 * 항공 예약 수하물 (사용자 요청 2026-11-24): 기내·위탁을 따로 입력하고, 저장은 예전처럼 한 줄 글자
 * (details.baggage "위탁 23kg · 기내 7kg") — 카드·백업·동기화 형식은 그대로
 */
export interface FlightBaggage {
  cabin: string;
  checked: string;
}

/** 숫자만 쓰면 kg를 붙인다 ("23" → "23kg", "1개 23kg"는 그대로) */
function withUnit(v: string): string {
  const s = v.trim();
  return /^\d+(\.\d+)?$/.test(s) ? `${s}kg` : s;
}

/** 저장된 글자 → 기내·위탁 칸. 어느 쪽인지 모르는 예전 글자는 위탁 칸에 그대로 */
export function splitBaggage(text: string | undefined): FlightBaggage {
  const s = (text ?? '').trim();
  if (!s) return { cabin: '', checked: '' };
  const part = (word: string) =>
    new RegExp(String.raw`${word}\s*([^·,/]+)`).exec(s)?.[1]?.trim() ?? '';
  const cabin = part('기내');
  const checked = part('위탁');
  if (!cabin && !checked) return { cabin: '', checked: s };
  return { cabin, checked };
}

/** 기내·위탁 칸 → 저장할 글자 (둘 다 비면 undefined) */
export function joinBaggage(b: FlightBaggage): string | undefined {
  const parts = [
    b.checked.trim() && `위탁 ${withUnit(b.checked)}`,
    b.cabin.trim() && `기내 ${withUnit(b.cabin)}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
