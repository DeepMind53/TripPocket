// 로마자 → 한글 표기 (국립국어원 외래어 표기법: 일본어 헵번식, 중국어 한어병음).
// 도시 데이터 생성 스크립트에서만 쓴다 (앱 번들에 들어가지 않음).

const ONSET = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWEL = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const CODA = [
  '',
  'ㄱ',
  'ㄲ',
  'ㄳ',
  'ㄴ',
  'ㄵ',
  'ㄶ',
  'ㄷ',
  'ㄹ',
  'ㄺ',
  'ㄻ',
  'ㄼ',
  'ㄽ',
  'ㄾ',
  'ㄿ',
  'ㅀ',
  'ㅁ',
  'ㅂ',
  'ㅄ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
];

/** 자모 조합: ('ㄱ','ㅏ','ㄴ') → '간' */
export function syl(onset, vowel, coda = '') {
  const o = ONSET.indexOf(onset);
  const v = VOWEL.indexOf(vowel);
  const c = CODA.indexOf(coda);
  if (o < 0 || v < 0 || c < 0) throw new Error(`jamo ${onset}${vowel}${coda}`);
  return String.fromCharCode(0xac00 + (o * 21 + v) * 28 + c);
}

/** 마지막 글자에 받침 붙이기 */
function addCoda(out, coda) {
  if (!out) return out;
  const last = out.charCodeAt(out.length - 1) - 0xac00;
  if (last < 0 || last > 11171 || last % 28 !== 0) return out;
  return out.slice(0, -1) + String.fromCharCode(0xac00 + last + CODA.indexOf(coda));
}

// ── 일본어 ──────────────────────────────────────────────
const JV = { a: 'ㅏ', i: 'ㅣ', u: 'ㅜ', e: 'ㅔ', o: 'ㅗ' };
const JY = { a: 'ㅑ', u: 'ㅠ', o: 'ㅛ', e: 'ㅖ' };

/** "Zentsūji" → "젠쓰지", "Sapporo" → "삿포로" */
export function romajiToHangul(input) {
  const s = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z' -]/g, '');
  let out = '';
  for (const word of s.split(/[ -]+/).filter(Boolean)) {
    let i = 0;
    let first = true;
    const w = word;
    while (i < w.length) {
      const rest = w.slice(i);
      // 받침 ㄴ: n + (자음|끝|'), m + (b|p|m) (Gotemba → 고템바)
      if (rest[0] === 'm' && /^m[bp]/.test(rest)) {
        out = addCoda(out, 'ㄴ');
        i += 1;
        continue;
      }
      if (rest[0] === 'n' && (rest.length === 1 || rest[1] === "'" || !/[aiueoy]/.test(rest[1]))) {
        out = addCoda(out, 'ㄴ');
        i += rest[1] === "'" ? 2 : 1;
        continue;
      }
      if (rest[0] === "'") {
        i += 1;
        continue;
      }
      // 촉음: 같은 자음 두 번, tch
      if (/^([kstpcgbdzjfmhr])\1/.test(rest) || rest.startsWith('tch')) {
        out = addCoda(out, 'ㅅ');
        i += 1;
        continue;
      }
      const m =
        /^(ky|gy|sh|ch|ts|ny|hy|by|py|my|ry|j|f|k|g|s|z|t|d|n|h|b|p|m|y|r|w|v)?([aiueo])/.exec(
          rest,
        );
      if (!m) {
        i += 1;
        continue;
      }
      const [, c = '', v] = m;
      out += kana(c, v, first);
      first = false;
      i += m[0].length;
    }
  }
  return out;
}

function kana(c, v, first) {
  const plain = (o) => syl(o, JV[v]);
  const yo = (o) => syl(o, v === 'i' ? 'ㅣ' : (JY[v] ?? JV[v]));
  switch (c) {
    case '':
      return plain('ㅇ');
    case 'k':
      return plain(first ? 'ㄱ' : 'ㅋ');
    case 'g':
      return plain('ㄱ');
    case 's':
      return syl('ㅅ', v === 'u' ? 'ㅡ' : JV[v]);
    case 'z':
      return syl('ㅈ', v === 'u' ? 'ㅡ' : JV[v]);
    case 'sh':
      return yo('ㅅ');
    case 'j':
      return syl('ㅈ', JV[v]);
    case 't':
      return plain(first ? 'ㄷ' : 'ㅌ');
    case 'd':
      return plain('ㄷ');
    case 'ch':
      return syl(first ? 'ㅈ' : 'ㅊ', JV[v]);
    case 'ts':
      return syl('ㅆ', 'ㅡ');
    case 'n':
      return plain('ㄴ');
    case 'h':
      return plain('ㅎ');
    case 'f':
      return v === 'u' ? syl('ㅎ', 'ㅜ') : plain('ㅍ');
    case 'b':
      return plain('ㅂ');
    case 'p':
      return plain('ㅍ');
    case 'm':
      return plain('ㅁ');
    case 'y':
      return syl('ㅇ', JY[v] ?? JV[v]);
    case 'r':
      return plain('ㄹ');
    case 'w':
      return v === 'a' ? syl('ㅇ', 'ㅘ') : plain('ㅇ');
    case 'v':
      return plain('ㅂ');
    case 'ky':
      return yo(first ? 'ㄱ' : 'ㅋ');
    case 'gy':
      return yo('ㄱ');
    case 'ny':
      return yo('ㄴ');
    case 'hy':
      return yo('ㅎ');
    case 'by':
      return yo('ㅂ');
    case 'py':
      return yo('ㅍ');
    case 'my':
      return yo('ㅁ');
    case 'ry':
      return yo('ㄹ');
    default:
      throw new Error(c);
  }
}

// ── 중국어 (한어병음) ───────────────────────────────────
const INITIAL = {
  b: 'ㅂ',
  p: 'ㅍ',
  m: 'ㅁ',
  f: 'ㅍ',
  d: 'ㄷ',
  t: 'ㅌ',
  n: 'ㄴ',
  l: 'ㄹ',
  g: 'ㄱ',
  k: 'ㅋ',
  h: 'ㅎ',
  j: 'ㅈ',
  q: 'ㅊ',
  x: 'ㅅ',
  zh: 'ㅈ',
  ch: 'ㅊ',
  sh: 'ㅅ',
  r: 'ㄹ',
  z: 'ㅉ',
  c: 'ㅊ',
  s: 'ㅆ',
  '': 'ㅇ',
};
const INITIALS = [
  'zh',
  'ch',
  'sh',
  'b',
  'p',
  'm',
  'f',
  'd',
  't',
  'n',
  'l',
  'g',
  'k',
  'h',
  'j',
  'q',
  'x',
  'r',
  'z',
  'c',
  's',
  'y',
  'w',
  '',
];
/** 운모 → [모음들(첫 글자), 받침, 뒤에 붙는 글자] */
const FINAL = {
  a: ['ㅏ'],
  o: ['ㅗ'],
  e: ['ㅓ'],
  ai: ['ㅏ', '', '이'],
  ei: ['ㅔ', '', '이'],
  ao: ['ㅏ', '', '오'],
  ou: ['ㅓ', '', '우'],
  an: ['ㅏ', 'ㄴ'],
  en: ['ㅓ', 'ㄴ'],
  ang: ['ㅏ', 'ㅇ'],
  eng: ['ㅓ', 'ㅇ'],
  ong: ['ㅜ', 'ㅇ'],
  er: ['ㅓ', 'ㄹ'],
  i: ['ㅣ'],
  ia: ['ㅑ'],
  ie: ['ㅖ'],
  iao: ['ㅑ', '', '오'],
  iu: ['ㅠ'],
  ian: ['ㅖ', 'ㄴ'],
  in: ['ㅣ', 'ㄴ'],
  iang: ['ㅑ', 'ㅇ'],
  ing: ['ㅣ', 'ㅇ'],
  iong: ['ㅠ', 'ㅇ'],
  u: ['ㅜ'],
  ua: ['ㅘ'],
  uo: ['ㅝ'],
  uai: ['ㅘ', '', '이'],
  ui: ['ㅜ', '', '이'],
  uan: ['ㅘ', 'ㄴ'],
  un: ['ㅜ', 'ㄴ'],
  uang: ['ㅘ', 'ㅇ'],
  ue: ['ㅞ'],
  v: ['ㅟ'],
  ve: ['ㅞ'],
};
const FINALS = Object.keys(FINAL).sort((a, b) => b.length - a.length);

function pinyinSyllable(ini, fin) {
  let onset = INITIAL[ini === 'y' || ini === 'w' ? '' : ini];
  let f = fin;
  // y-, w- 형
  if (ini === 'y')
    f =
      {
        i: 'i',
        a: 'ia',
        e: 'ie',
        ao: 'iao',
        ou: 'iu',
        an: 'ian',
        in: 'in',
        ang: 'iang',
        ing: 'ing',
        ong: 'iong',
        u: 'v',
        ue: 've',
        uan: 'van',
        un: 'vn',
      }[fin] ?? fin;
  if (ini === 'w')
    f =
      {
        u: 'u',
        a: 'ua',
        o: 'uo',
        ai: 'uai',
        ei: 'ui',
        an: 'uan',
        en: 'un',
        ang: 'uang',
        eng: 'ueng',
      }[fin] ?? fin;
  const jqx = ini === 'j' || ini === 'q' || ini === 'x';
  if (jqx && f.startsWith('u')) f = 'v' + f.slice(1); // ju = jü
  // 특수
  if (f === 'i' && ['zh', 'ch', 'sh', 'r', 'z', 'c', 's'].includes(ini)) return syl(onset, 'ㅡ');
  if (f === 'van') return syl(onset, 'ㅟ') + syl('ㅇ', 'ㅏ', 'ㄴ'); // 위안
  if (f === 'vn') return syl(onset, 'ㅟ', 'ㄴ');
  if (f === 'ueng') return syl('ㅇ', 'ㅝ', 'ㅇ');
  if (ini === 'w' && f === 'uo') return syl('ㅇ', 'ㅝ');
  if (ini === 'w' && f === 'ui') return syl('ㅇ', 'ㅞ') + '이';
  if (ini === 'w' && f === 'un') return syl('ㅇ', 'ㅝ', 'ㄴ');
  if (ini === '' && f === 'ui') return syl('ㅇ', 'ㅞ') + '이';
  if (f === 'iu' && ini && ini !== 'y' && !jqx && !['n', 'l'].includes(ini))
    return syl(onset, 'ㅑ') + '우';
  const spec = FINAL[f];
  if (!spec) return null;
  let [v, coda = '', tail = ''] = spec;
  // j·q·x 뒤 ㅑ·ㅖ·ㅕ → ㅏ·ㅔ·ㅔ (자, 제, 젠), x 는 샤·셰·셴 그대로
  if (jqx && ini !== 'x') v = { ㅑ: 'ㅏ', ㅖ: 'ㅔ', ㅕ: 'ㅔ', ㅠ: 'ㅜ' }[v] ?? v;
  // zh·ch·sh 뒤 ㅑ 계열 없음 / 초성 ㄹ+ㅖ 등은 그대로 둔다
  return syl(onset, v, coda) + tail;
}

/** "Tanzi" → "탄쯔", 해석 못 하면 null */
export function pinyinToHangul(input) {
  const s = input.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ü/g, 'v');
  const words = s.split(/[\s'-]+/).filter(Boolean);
  let out = '';
  for (const w of words) {
    const parts = parse(w);
    if (!parts) return null;
    for (const [ini, fin] of parts) {
      const h = pinyinSyllable(ini, fin);
      if (!h) return null;
      out += h;
    }
  }
  return out;
}

/** 음절 나누기. 모음으로 시작하는 음절이 뒤에 오는 분할은 피한다 (병음 규칙) */
function parse(w) {
  if (!w) return [];
  for (const ini of INITIALS) {
    if (!w.startsWith(ini)) continue;
    for (const fin of FINALS) {
      if (!w.startsWith(fin, ini.length)) continue;
      if (!valid(ini, fin)) continue;
      const rest = w.slice(ini.length + fin.length);
      if (rest && /^[aeiouv]/.test(rest)) continue;
      const tail = parse(rest);
      if (tail) return [[ini, fin], ...tail];
    }
  }
  return null;
}

function valid(ini, fin) {
  if (ini === 'y')
    return [
      'i',
      'a',
      'e',
      'ao',
      'ou',
      'an',
      'in',
      'ang',
      'ing',
      'ong',
      'u',
      'ue',
      'uan',
      'un',
      'o',
    ].includes(fin);
  if (ini === 'w') return ['u', 'a', 'o', 'ai', 'ei', 'an', 'en', 'ang', 'eng'].includes(fin);
  if (ini === '')
    return ['a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'er'].includes(fin);
  if (['j', 'q', 'x'].includes(ini))
    return fin.startsWith('i') || fin.startsWith('u') || fin === 'v' || fin === 've';
  if (
    fin.startsWith('i') &&
    ['g', 'k', 'h', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'f'].includes(ini)
  )
    return fin === 'i' && !['g', 'k', 'h', 'f'].includes(ini);
  if (fin === 'v' || fin === 've') return ini === 'n' || ini === 'l';
  return true;
}
