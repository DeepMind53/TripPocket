import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 화면에 붙는 요소(fixed·sticky)는 겹침 순서(z-)를 꼭 정한다 (사용자 요청 2026-11-23:
 * 여행 모드 노선 번호(z-[1])가 아래 [숙소로 길찾기] 버튼 줄 위로 보였다 — 버튼은 늘 내용보다 위).
 * className 한 덩어리(따옴표 안)에 fixed/sticky가 있으면 같은 덩어리나 바로 다음 줄에 z-가 있어야 한다
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : [];
  });
}

it('fixed·sticky 요소는 모두 z-를 정한다', () => {
  const missing: string[] = [];
  for (const file of files('src')) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/(["'`])([^"'`]*)\1/g)) {
        const cls = m[2]!;
        if (!/(^|\s)(fixed|sticky)(\s|$)/.test(cls)) continue;
        // 같은 덩어리, 또는 cn( ) 안 바로 다음 줄 덩어리 (예: PlanPage 'sticky …', 다음 줄 'z-10')
        const near = cls + ' ' + (lines[i + 1] ?? '');
        if (!/(^|[\s'"`:])z-(\[|\d)/.test(near))
          missing.push(`${file}:${i + 1} ${cls.slice(0, 60)}`);
      }
    });
  }
  expect(missing).toEqual([]);
});
