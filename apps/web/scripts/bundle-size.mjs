// 첫 화면에 필요한 JS 크기 (index.html이 부르는 진입 파일 + 정적 import로 함께 받는 파일, gzip)
// 사용: pnpm build 후 `node scripts/bundle-size.mjs`
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = join(import.meta.dirname, '..', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const entry = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
if (!entry) throw new Error('index.html에서 진입 파일을 찾지 못했어요');

const seen = new Set();
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const code = readFileSync(join(dist, 'assets', file), 'utf8');
  // 정적 import만 따라간다 (import("...")는 나중에 불러오는 파일)
  for (const m of code.matchAll(
    /(?:^|[;\n}])\s*import\s*(?:[^'"()]*?from\s*)?["']\.\/([^"']+\.js)["']/g,
  )) {
    visit(m[1]);
  }
}
visit(entry);

let total = 0;
const rows = [...seen].map((f) => {
  const gz = gzipSync(readFileSync(join(dist, 'assets', f))).length;
  total += gz;
  return [f, gz];
});
rows.sort((a, b) => b[1] - a[1]);
for (const [f, gz] of rows) console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB  ${f}`);
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  첫 화면 합계 (gzip)`);

const lazy = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js') && !seen.has(f));
console.log(`\n나중에 불러오는 파일 ${lazy.length}개`);

// 예산 (CLAUDE.md: 첫 화면 합계 300KB, 2026-10-24 사용자 결정) — 넘으면 CI 실패
const BUDGET_KB = 300;
if (total / 1024 > BUDGET_KB) {
  console.error(`\n첫 화면 합계가 예산 ${BUDGET_KB}KB를 넘었어요`);
  process.exitCode = 1;
}
