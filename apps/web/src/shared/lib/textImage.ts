/**
 * 일정 이미지 (S-25 "이미지로 저장") — 라이브러리 없이 캔버스에 글자를 그린다.
 * 첫 줄 = 제목(파란 띠), 둘째 줄 = 기간, "[...]" 줄 = 소제목. 카톡에 보내기 좋은 1080px 폭
 */
export async function textToImage(lines: readonly string[]): Promise<Blob> {
  const W = 1080;
  const PAD = 72;
  const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');

  // 긴 줄은 폭에 맞춰 나눈다
  const wrap = (text: string, font: string): string[] => {
    ctx.font = font;
    const out: string[] = [];
    let cur = '';
    for (const ch of text) {
      if (ctx.measureText(cur + ch).width > W - PAD * 2 && cur) {
        out.push(cur);
        cur = ch.trimStart();
      } else cur += ch;
    }
    return [...out, cur];
  };
  type Row = { text: string; font: string; color: string; h: number };
  const rows: Row[] = [];
  lines.slice(2).forEach((l) => {
    if (!l) rows.push({ text: '', font: '', color: '', h: 20 });
    else if (l.startsWith('['))
      rows.push(
        ...wrap(l.slice(1, -1), `700 38px ${FONT}`).map((text) => ({
          text,
          font: `700 38px ${FONT}`,
          color: '#2F6BFF',
          h: 64,
        })),
      );
    else
      rows.push(
        ...wrap(l, `400 34px ${FONT}`).map((text) => ({
          text,
          font: `400 34px ${FONT}`,
          color: '#191F28',
          h: 52,
        })),
      );
  });
  const HEADER = 220;
  canvas.width = W;
  canvas.height = HEADER + PAD + rows.reduce((s, r) => s + r.h, 0) + PAD;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = '#2F6BFF';
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  ctx.font = `800 56px ${FONT}`;
  ctx.fillText(lines[0] ?? '', PAD, 56, W - PAD * 2);
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(lines[1] ?? '', PAD, 138, W - PAD * 2);

  let y = HEADER + PAD;
  for (const r of rows) {
    if (r.text) {
      ctx.font = r.font;
      ctx.fillStyle = r.color;
      ctx.fillText(r.text, PAD, y);
    }
    y += r.h;
  }
  ctx.font = `500 26px ${FONT}`;
  ctx.fillStyle = '#8B95A1';
  ctx.fillText(
    'TripPocket',
    W - PAD - ctx.measureText('TripPocket').width,
    canvas.height - PAD + 10,
  );

  return new Promise((ok, fail) =>
    canvas.toBlob((b) => (b ? ok(b) : fail(new Error('image'))), 'image/png'),
  );
}
