/** 기기에 저장한 파일 열기 (오프라인에서도) — 예약 문서·빠른 메뉴 바우처가 함께 쓴다 */
export function openBlob(blob: Blob | undefined): void {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
