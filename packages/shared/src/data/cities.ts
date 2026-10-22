/**
 * 여행 만들기 추천 도시 (docs/13 §2 "도시 → 타임존" 정적 데이터).
 * 번들 크기를 위해 자주 가는 도시만 담는다. 목록에 없으면 직접 입력 + 기기 타임존.
 */
export interface City {
  name: string;
  /** ISO 3166-1 alpha-2 — KR이면 지도 기본값이 네이버 (docs/10 §3) */
  country: string;
  timezone: string;
  emoji: string;
}

export const CITIES: readonly City[] = [
  { name: '서울', country: 'KR', timezone: 'Asia/Seoul', emoji: '🏙️' },
  { name: '부산', country: 'KR', timezone: 'Asia/Seoul', emoji: '🌊' },
  { name: '제주', country: 'KR', timezone: 'Asia/Seoul', emoji: '🍊' },
  { name: '강릉', country: 'KR', timezone: 'Asia/Seoul', emoji: '☕' },
  { name: '경주', country: 'KR', timezone: 'Asia/Seoul', emoji: '🏯' },
  { name: '여수', country: 'KR', timezone: 'Asia/Seoul', emoji: '🌉' },
  { name: '도쿄', country: 'JP', timezone: 'Asia/Tokyo', emoji: '🗼' },
  { name: '오사카', country: 'JP', timezone: 'Asia/Tokyo', emoji: '🏯' },
  { name: '교토', country: 'JP', timezone: 'Asia/Tokyo', emoji: '⛩️' },
  { name: '후쿠오카', country: 'JP', timezone: 'Asia/Tokyo', emoji: '🍜' },
  { name: '삿포로', country: 'JP', timezone: 'Asia/Tokyo', emoji: '⛄' },
  { name: '오키나와', country: 'JP', timezone: 'Asia/Tokyo', emoji: '🏖️' },
  { name: '타이베이', country: 'TW', timezone: 'Asia/Taipei', emoji: '🏮' },
  { name: '홍콩', country: 'HK', timezone: 'Asia/Hong_Kong', emoji: '🌃' },
  { name: '상하이', country: 'CN', timezone: 'Asia/Shanghai', emoji: '🏙️' },
  { name: '방콕', country: 'TH', timezone: 'Asia/Bangkok', emoji: '🛕' },
  { name: '다낭', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', emoji: '🏝️' },
  { name: '나트랑', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', emoji: '🏖️' },
  { name: '싱가포르', country: 'SG', timezone: 'Asia/Singapore', emoji: '🦁' },
  { name: '세부', country: 'PH', timezone: 'Asia/Manila', emoji: '🐠' },
  { name: '발리', country: 'ID', timezone: 'Asia/Makassar', emoji: '🌺' },
  { name: '괌', country: 'GU', timezone: 'Pacific/Guam', emoji: '🌴' },
  { name: '하와이', country: 'US', timezone: 'Pacific/Honolulu', emoji: '🌺' },
  { name: '파리', country: 'FR', timezone: 'Europe/Paris', emoji: '🥐' },
  { name: '런던', country: 'GB', timezone: 'Europe/London', emoji: '💂' },
  { name: '로마', country: 'IT', timezone: 'Europe/Rome', emoji: '🏛️' },
  { name: '뉴욕', country: 'US', timezone: 'America/New_York', emoji: '🗽' },
];

export function findCity(name: string): City | undefined {
  return CITIES.find((c) => c.name === name.trim());
}

/** 이름에 검색어가 들어간 도시 (공백 무시) */
export function searchCities(query: string): City[] {
  const q = query.replace(/\s/g, '');
  if (!q) return [...CITIES];
  return CITIES.filter((c) => c.name.includes(q));
}
