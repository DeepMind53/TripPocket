/**
 * UUID v7 (RFC 9562): 앞 48비트가 밀리초 타임스탬프라 생성 순서대로 정렬된다 (docs/08 B8).
 * 같은 밀리초 안에서도 순서가 유지되도록 12비트 카운터(rand_a 자리)를 사용한다.
 */
let lastMs = -1;
let counter = 0;

export function uuidv7(now: number = Date.now()): string {
  if (now === lastMs) {
    counter = (counter + 1) & 0xfff;
    // 카운터가 넘치면 다음 밀리초로 미룬다
    if (counter === 0) now = ++lastMs;
  } else if (now < lastMs) {
    // 시계가 뒤로 가도 단조 증가 유지
    now = lastMs;
    counter = (counter + 1) & 0xfff;
  } else {
    lastMs = now;
    counter = 0;
  }
  lastMs = now;

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // 48비트 타임스탬프 (big-endian)
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  // 버전 7 + 카운터 상위 4비트, 카운터 하위 8비트
  bytes[6] = 0x70 | ((counter >> 8) & 0x0f);
  bytes[7] = counter & 0xff;
  // 변형(variant) 10xx
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
