/**
 * 국기 이모지 (국가 코드 → 지역 표시 문자).
 * 도시 목록(places.ts, 약 50KB)과 따로 둔다 — 첫 화면(여행 카드의 국기)이 도시 목록까지 싣지 않게
 */
export function flagEmoji(countryCode: string): string {
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0)),
  );
}
