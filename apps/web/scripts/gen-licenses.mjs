// 앱에 들어가는 오픈소스 목록 → src/features/legal/licenses.json (오픈소스 라이선스 화면, 23단계)
// pnpm 내장 기능으로 읽는다 (따로 받을 도구 없음). 의존성이 바뀌면 다시 실행:
//   node scripts/gen-licenses.mjs
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const raw = execSync('pnpm --filter @trippocket/web licenses list --prod --json', {
  encoding: 'utf8',
  cwd: new URL('..', import.meta.url),
});
const list = Object.values(JSON.parse(raw))
  .flat()
  .filter((p) => !p.name.startsWith('@types/'))
  .map((p) => ({
    name: p.name,
    version: p.versions.join(', '),
    license: p.license,
    url: p.homepage ?? '',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(
  new URL('../src/features/legal/licenses.json', import.meta.url),
  `${JSON.stringify(list, null, 2)}\n`,
);
console.log(`${list.length}개`);
