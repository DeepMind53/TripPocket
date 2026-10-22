// 한국·일본·대만 전체 시·군·구(정·촌·향) 목록을 GeoNames(CC BY 4.0)에서 만들어
// src/data/placesGen.ts 로 쓴다. 손으로 고른 places.ts / placesAsia.ts가 항상 우선.
//
// 사용: GeoNames 덤프를 받아 압축을 푼 폴더를 넘긴다
//   https://download.geonames.org/export/dump/{KR,JP,TW}.zip
//   https://download.geonames.org/export/dump/alternatenames/{KR,JP,TW}.zip  → alt{CC}/ 폴더로
//   node scripts/gen-places.mjs <폴더>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pinyinToHangul, romajiToHangul } from './translit.mjs';

const dir = process.argv[2];
if (!dir) throw new Error('GeoNames 폴더를 넘겨 주세요');
const here = new URL('../src/data/', import.meta.url);

const rows = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));

// ── 손으로 고른 도시 (중복·근접 확인용)
const curated = [];
for (const f of ['places.ts', 'placesAsia.ts', 'placesTravel.ts']) {
  const s = readFileSync(new URL(f, here), 'utf8');
  for (const m of s.matchAll(
    /\[\s*'([^']+)',\s*'[^']*',\s*'([A-Z]{2})',\s*(?:\w+|'[^']*'),\s*([\d.-]+),\s*([\d.-]+)/g,
  ))
    curated.push({ ko: m[1], cc: m[2], lat: +m[3], lng: +m[4] });
  for (const m of s.matchAll(/\b(kr|jp|tw|cn)\('([^']+)',\s*'[^']*',\s*([\d.-]+),\s*([\d.-]+)/g))
    curated.push({ ko: m[2], cc: m[1].toUpperCase(), lat: +m[3], lng: +m[4] });
}
const km = (a, b) => {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6371;
};
/** 손으로 고른 도시와 같은 곳이면 건너뛴다 (같은 이름이거나 아주 가까움) */
const isCurated = (cc, ko, p, near) =>
  curated.some((c) => c.cc === cc && (c.ko === ko || c.ko.endsWith(` ${ko}`) || km(c, p) < near));

function load(cc) {
  const alt = new Map();
  for (const r of rows(join(dir, `alt${cc}`, `${cc}.txt`))) {
    if (r[7] === '1' || !['ko', 'ja', 'zh'].includes(r[2])) continue;
    const m = alt.get(r[1]) ?? {};
    // 선호 이름이 있으면 그것
    if (!m[r[2]] || r[4] === '1') m[r[2]] = r[3];
    alt.set(r[1], m);
  }
  const all = rows(join(dir, cc, `${cc}.txt`)).map((r) => ({
    id: r[0],
    name: r[1],
    ascii: r[2],
    lat: +r[4],
    lng: +r[5],
    code: r[7],
    a1: r[10],
    a2: r[11],
    pop: +r[14],
    ...alt.get(r[0]),
  }));
  return all;
}

const fix2 = (n) => Math.round(n * 100) / 100;
const out = {};
const aliasOut = [];

/** 이름이 겹치면 상위 지역 이름을 앞에 (예: "히로시마 후추") */
function dedupe(list, cc) {
  const byName = new Map();
  for (const p of list) byName.set(p.ko, [...(byName.get(p.ko) ?? []), p]);
  const res = [];
  for (const [, same] of byName) {
    same.sort((a, b) => b.pop - a.pop);
    same.forEach((p, i) => {
      const clash = i > 0 || curated.some((c) => c.cc === cc && c.ko === p.ko);
      res.push(clash ? { ...p, ko: `${p.region} ${p.ko}` } : p);
    });
  }
  return res;
}

// ── 대한민국: 시·군 (구는 소속 도시의 별칭)
{
  const all = load('KR');
  const adm1 = new Map(all.filter((p) => p.code === 'ADM1').map((p) => [p.a1, p]));
  const base = (ko) => ko.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '');
  const short = {
    경상북: '경북',
    경상남: '경남',
    전라북: '전북',
    전라남: '전남',
    충청북: '충북',
    충청남: '충남',
    전북: '전북',
    강원: '강원',
  };
  const adm2 = all.filter((p) => p.code === 'ADM2' && p.ko);
  const cities = [];
  const gu = [];
  for (const p of adm2) {
    const ko = p.ko.replace(/\s/g, '');
    const a1 = adm1.get(p.a1);
    const region = short[base(a1?.ko ?? '')] ?? base(a1?.ko ?? '').slice(0, 2);
    if (/구$/.test(ko)) gu.push({ ...p, ko, region, a1ko: base(a1?.ko ?? '') });
    else if (/[시군]$/.test(ko))
      cities.push({ ...p, ko: ko.slice(0, -1), region, en: p.ascii.replace(/-(si|gun)$/i, '') });
  }
  const list = dedupe(
    cities.filter((p) => !isCurated('KR', p.ko, p, 6)),
    'KR',
  );
  out.KR = list;
  // 구 → 광역시면 그 시, 아니면 같은 도의 가장 가까운 시
  const parents = [...curated.filter((c) => c.cc === 'KR'), ...list];
  const groups = new Map();
  for (const g of gu) {
    const metro = parents.find((c) => c.ko === g.a1ko);
    const target =
      metro ??
      parents
        .filter((c) => c.region === undefined || c.region === g.region)
        .sort((a, b) => km(a, g) - km(b, g))[0];
    if (!target) continue;
    groups.set(target.ko, [...(groups.get(target.ko) ?? []), g.ko, g.ko.slice(0, -1)]);
  }
  // "중구·동구"처럼 여러 도시에 있는 이름은 별칭으로 쓰지 않는다
  const count = new Map();
  for (const g of gu) count.set(g.ko, (count.get(g.ko) ?? 0) + 1);
  for (const [ko, names] of groups) {
    const uniq = names.filter((n, i) => i % 2 === 0 && count.get(n) === 1);
    const all = uniq.flatMap((n) => [n, n.slice(0, -1)]).filter((n) => n.length > 1);
    if (all.length) aliasOut.push(['KR', ko, [...new Set(all)]]);
  }
}

// ── 일본: 시(ADM2 "Shi") + 정·촌(ADM3), 도쿄 23구는 도쿄 별칭
{
  const all = load('JP');
  const adm1 = new Map(all.filter((p) => p.code === 'ADM1').map((p) => [p.a1, p]));
  const PREF = {
    Hokkaido: '홋카이도',
    Aomori: '아오모리',
    Iwate: '이와테',
    Miyagi: '미야기',
    Akita: '아키타',
    Yamagata: '야마가타',
    Fukushima: '후쿠시마',
    Ibaraki: '이바라키',
    Tochigi: '도치기',
    Gunma: '군마',
    Saitama: '사이타마',
    Chiba: '지바',
    Tokyo: '도쿄',
    Kanagawa: '가나가와',
    Niigata: '니가타',
    Toyama: '도야마',
    Ishikawa: '이시카와',
    Fukui: '후쿠이',
    Yamanashi: '야마나시',
    Nagano: '나가노',
    Gifu: '기후',
    Shizuoka: '시즈오카',
    Aichi: '아이치',
    Mie: '미에',
    Shiga: '시가',
    Kyoto: '교토',
    Osaka: '오사카',
    Hyogo: '효고',
    Nara: '나라',
    Wakayama: '와카야마',
    Tottori: '돗토리',
    Shimane: '시마네',
    Okayama: '오카야마',
    Hiroshima: '히로시마',
    Yamaguchi: '야마구치',
    Tokushima: '도쿠시마',
    Kagawa: '가가와',
    Ehime: '에히메',
    Kochi: '고치',
    Fukuoka: '후쿠오카',
    Saga: '사가',
    Nagasaki: '나가사키',
    Kumamoto: '구마모토',
    Oita: '오이타',
    Miyazaki: '미야자키',
    Kagoshima: '가고시마',
    Okinawa: '오키나와',
  };
  const prefKo = (a1) => {
    const en = (adm1.get(a1)?.ascii ?? '').replace(/[- ](Prefecture|Ken|Fu|To|Do)$/i, '').trim();
    return PREF[en] ?? romajiToHangul(en);
  };
  const strip = (n) =>
    n
      .replace(/[- ](shi|machi|chō|cho|mura|son|ku|gun)$/i, '')
      .replace(/ \(.*\)$/, '')
      .trim();
  const list = [];
  const wards = [];
  for (const p of all) {
    const isCity = p.code === 'ADM2' && /[- ]shi$/i.test(p.name);
    const isTown = p.code === 'ADM3' && /[- ](machi|chō|cho|mura|son)$/i.test(p.name);
    const isWard = p.code === 'ADM2' && /[- ]ku$/i.test(p.name) && p.a1 === '40'; // 도쿄도
    if (!isCity && !isTown && !isWard) continue;
    const name = strip(p.name);
    const ko = romajiToHangul(name);
    if (!ko) continue;
    if (isWard) {
      wards.push(ko);
      continue;
    }
    const item = { ...p, ko, en: strip(p.ascii), region: prefKo(p.a1), aliases: [] };
    if (!isCurated('JP', ko, p, 3)) list.push(item);
  }
  out.JP = dedupe(list, 'JP');
  aliasOut.push(['JP', '도쿄', wards.filter(Boolean)]);
}

// ── 대만: 현·시(ADM2) + 향·진·시·구(ADM3)
{
  const all = load('TW');
  const KO2 = {
    'New Taipei City': '신베이',
    'Taipei City': '타이베이',
    Tainan: '타이난',
    Taichung: '타이중',
    Kaohsiung: '가오슝',
    Taoyuan: '타오위안',
    'Hsinchu County': '신주',
    Hsinchu: '신주',
    Keelung: '지룽',
    Chiayi: '자이',
    'Chiayi County': '자이',
    'Kinmen County': '진먼',
    'Lienchiang County': '롄장',
    Yilan: '이란',
    Hualien: '화롄',
    Taitung: '타이둥',
    Pingtung: '핑둥',
    Nantou: '난터우',
    Changhua: '장화',
    Yunlin: '윈린',
    Miaoli: '먀오리',
    Penghu: '펑후',
  };
  const adm2 = new Map(all.filter((p) => p.code === 'ADM2').map((p) => [p.a2, p]));
  const regionOf = (p) => {
    const a = adm2.get(p.a2);
    const n = a?.name.replace(/ (County|City)$/, '') ?? '';
    return KO2[a?.name] ?? KO2[n] ?? a?.ko?.replace(/ ?(현|시)$/, '') ?? '';
  };
  const list = [];
  for (const p of all) {
    if (p.code !== 'ADM2' && p.code !== 'ADM3') continue;
    const name = p.name
      .replace(
        / (District|Township|Urban Township|Rural Township|City|County|Mountain Indigenous District)$/i,
        '',
      )
      .replace(/ (Urban|Rural|Mountain Indigenous)$/i, '');
    const ko =
      p.code === 'ADM2' ? (KO2[p.name] ?? KO2[name] ?? pinyinToHangul(name)) : pinyinToHangul(name);
    if (!ko) continue;
    const item = { ...p, ko, en: name, region: regionOf(p), aliases: [] };
    if (!isCurated('TW', ko, p, 2)) list.push(item);
  }
  out.TW = dedupe(list, 'TW');
}

// ── 쓰기: 나라별 "한글,영어,위도,경도,별칭|별칭" 줄
const line = (p) =>
  [p.ko, p.en.replace(/,/g, ''), fix2(p.lat), fix2(p.lng), (p.aliases ?? []).join('|')]
    .join(',')
    .replace(/,$/, '');
const body = Object.entries(out)
  .map(([cc, list]) => `  ${cc}: \`${list.map(line).join('\n')}\`,`)
  .join('\n');
const aliases = aliasOut.map(([cc, ko, names]) => `${cc},${ko},${names.join('|')}`).join('\n');
writeFileSync(
  new URL('placesGen.ts', here),
  `// 자동 생성 파일 — 고치지 말고 scripts/gen-places.mjs 를 다시 실행하세요.
// 출처: GeoNames (https://www.geonames.org, CC BY 4.0). 한글 표기는 외래어 표기법 규칙으로 변환.
// 줄 = "한글,영어,위도,경도,별칭|별칭"

export const GEN_PLACES: Record<string, string> = {
${body}
};

/** 기존 도시에 붙일 별칭 (구·도쿄 23구). 줄 = "나라,한글,별칭|별칭" */
export const GEN_ALIASES = \`${aliases}\`;
`,
);
for (const [cc, list] of Object.entries(out)) console.log(cc, list.length);
