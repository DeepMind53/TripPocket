/**
 * 찍은 사진을 긴 변 1600px JPEG로 줄인다 (사진·영수증, ADR-0012). 기기 저장 용량과 글자 인식 전송량을 줄이려고.
 * 사진 방향(EXIF)은 createImageBitmap이 맞춰 준다. 줄일 수 없는 브라우저면 원본 그대로
 */
export async function shrinkImage(file: Blob, max = 1600, quality = 0.82): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bmp.close();
    return file;
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((ok, fail) =>
    canvas.toBlob((b) => (b ? ok(b) : fail(new Error('no jpeg'))), 'image/jpeg', quality),
  );
}
