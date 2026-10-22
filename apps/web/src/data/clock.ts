/** 현재 시각 ISO 문자열 (테스트에서 vi.setSystemTime으로 고정 가능) */
export function nowIso(): string {
  return new Date().toISOString();
}
