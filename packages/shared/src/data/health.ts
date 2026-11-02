/**
 * 알레르기·건강 카드 (사용자 요청 2026-11-02): 식당·병원에서 현지인에게 보여 주는 문장.
 * 언어는 회화(phrases.ts)와 같은 12개. 직접 적은 약 이름은 번역하지 않고 번역기 바로가기로 넘긴다.
 * 번역은 참고용 — 화면에 "중요하면 직원에게 한 번 더 확인"을 함께 적는다
 */
export const ALLERGENS = [
  'peanut',
  'treeNut',
  'shellfish',
  'fish',
  'egg',
  'milk',
  'wheat',
  'soy',
  'sesame',
  'pork',
  'beef',
  'alcohol',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_KO: Record<Allergen, string> = {
  peanut: '땅콩',
  treeNut: '견과류',
  shellfish: '갑각류(새우·게)',
  fish: '생선',
  egg: '달걀',
  milk: '우유·유제품',
  wheat: '밀',
  soy: '콩',
  sesame: '참깨',
  pork: '돼지고기',
  beef: '소고기',
  alcohol: '술',
};

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

interface HealthLang {
  /** {list} 자리에 알레르기 목록 */
  allergy: string;
  /** 목록 구분 */
  sep: string;
  blood: string;
  meds: string;
  words: Record<Allergen, string>;
}

const W = (w: string[]): Record<Allergen, string> =>
  Object.fromEntries(ALLERGENS.map((a, i) => [a, w[i]!])) as Record<Allergen, string>;

/** 언어 코드(phrases.ts PHRASE_LANGS.code) → 문장 */
export const HEALTH_LANGS: Record<string, HealthLang> = {
  ko: {
    allergy: '저는 다음 음식에 알레르기가 있어요: {list}\n이 음식에 들어 있나요?',
    sep: ', ',
    blood: '혈액형',
    meds: '복용 중인 약',
    words: ALLERGEN_KO,
  },
  ja: {
    allergy: '私は次の食べ物にアレルギーがあります：{list}\nこの料理に入っていますか？',
    sep: '、',
    blood: '血液型',
    meds: '服用中の薬',
    words: W([
      'ピーナッツ',
      'ナッツ類',
      '甲殻類（エビ・カニ）',
      '魚',
      '卵',
      '乳製品',
      '小麦',
      '大豆',
      'ごま',
      '豚肉',
      '牛肉',
      'アルコール',
    ]),
  },
  'zh-CN': {
    allergy: '我对以下食物过敏：{list}\n这道菜里有吗？',
    sep: '、',
    blood: '血型',
    meds: '正在服用的药物',
    words: W([
      '花生',
      '坚果',
      '甲壳类（虾、蟹）',
      '鱼',
      '鸡蛋',
      '乳制品',
      '小麦',
      '大豆',
      '芝麻',
      '猪肉',
      '牛肉',
      '酒精',
    ]),
  },
  'zh-TW': {
    allergy: '我對以下食物過敏：{list}\n這道菜裡有嗎？',
    sep: '、',
    blood: '血型',
    meds: '正在服用的藥物',
    words: W([
      '花生',
      '堅果',
      '甲殼類（蝦、蟹）',
      '魚',
      '雞蛋',
      '乳製品',
      '小麥',
      '大豆',
      '芝麻',
      '豬肉',
      '牛肉',
      '酒精',
    ]),
  },
  'zh-HK': {
    allergy: '我對以下食物敏感：{list}\n呢道菜有冇？',
    sep: '、',
    blood: '血型',
    meds: '正在服用嘅藥物',
    words: W([
      '花生',
      '果仁',
      '甲殼類（蝦、蟹）',
      '魚',
      '雞蛋',
      '奶類製品',
      '小麥',
      '大豆',
      '芝麻',
      '豬肉',
      '牛肉',
      '酒精',
    ]),
  },
  th: {
    allergy: 'ฉันแพ้อาหารต่อไปนี้: {list}\nอาหารนี้มีส่วนผสมเหล่านี้ไหม',
    sep: ', ',
    blood: 'กรุ๊ปเลือด',
    meds: 'ยาที่ใช้อยู่',
    words: W([
      'ถั่วลิสง',
      'ถั่วเปลือกแข็ง',
      'สัตว์มีเปลือก (กุ้ง ปู)',
      'ปลา',
      'ไข่',
      'นม',
      'แป้งสาลี',
      'ถั่วเหลือง',
      'งา',
      'เนื้อหมู',
      'เนื้อวัว',
      'แอลกอฮอล์',
    ]),
  },
  vi: {
    allergy: 'Tôi bị dị ứng với: {list}\nMón này có những thứ đó không?',
    sep: ', ',
    blood: 'Nhóm máu',
    meds: 'Thuốc đang dùng',
    words: W([
      'đậu phộng',
      'các loại hạt',
      'động vật có vỏ (tôm, cua)',
      'cá',
      'trứng',
      'sữa',
      'lúa mì',
      'đậu nành',
      'mè',
      'thịt heo',
      'thịt bò',
      'rượu bia',
    ]),
  },
  id: {
    allergy: 'Saya alergi terhadap: {list}\nApakah makanan ini mengandungnya?',
    sep: ', ',
    blood: 'Golongan darah',
    meds: 'Obat yang sedang diminum',
    words: W([
      'kacang tanah',
      'kacang-kacangan',
      'kerang-kerangan (udang, kepiting)',
      'ikan',
      'telur',
      'susu',
      'gandum',
      'kedelai',
      'wijen',
      'daging babi',
      'daging sapi',
      'alkohol',
    ]),
  },
  en: {
    allergy: 'I am allergic to: {list}\nDoes this dish contain any of these?',
    sep: ', ',
    blood: 'Blood type',
    meds: 'Current medication',
    words: W([
      'peanuts',
      'tree nuts',
      'shellfish (shrimp, crab)',
      'fish',
      'eggs',
      'milk / dairy',
      'wheat',
      'soy',
      'sesame',
      'pork',
      'beef',
      'alcohol',
    ]),
  },
  fr: {
    allergy: 'Je suis allergique à : {list}\nCe plat en contient-il ?',
    sep: ', ',
    blood: 'Groupe sanguin',
    meds: 'Médicaments en cours',
    words: W([
      'arachides',
      'fruits à coque',
      'crustacés (crevettes, crabe)',
      'poisson',
      'œufs',
      'lait',
      'blé',
      'soja',
      'sésame',
      'porc',
      'bœuf',
      'alcool',
    ]),
  },
  it: {
    allergy: 'Sono allergico a: {list}\nQuesto piatto li contiene?',
    sep: ', ',
    blood: 'Gruppo sanguigno',
    meds: 'Farmaci in uso',
    words: W([
      'arachidi',
      'frutta a guscio',
      'crostacei (gamberi, granchio)',
      'pesce',
      'uova',
      'latte',
      'grano',
      'soia',
      'sesamo',
      'maiale',
      'manzo',
      'alcol',
    ]),
  },
  es: {
    allergy: 'Tengo alergia a: {list}\n¿Este plato los contiene?',
    sep: ', ',
    blood: 'Grupo sanguíneo',
    meds: 'Medicamentos actuales',
    words: W([
      'cacahuetes',
      'frutos secos',
      'mariscos (gambas, cangrejo)',
      'pescado',
      'huevo',
      'leche',
      'trigo',
      'soja',
      'sésamo',
      'cerdo',
      'ternera',
      'alcohol',
    ]),
  },
  mn: {
    allergy: 'Би дараах хүнсэнд харшилтай: {list}\nЭнэ хоолонд орсон уу?',
    sep: ', ',
    blood: 'Цусны бүлэг',
    meds: 'Хэрэглэж буй эм',
    words: W([
      'газрын самар',
      'самар',
      'хавч хэлбэртэн (сам хорхой, хавч)',
      'загас',
      'өндөг',
      'сүү',
      'улаан буудай',
      'шар буурцаг',
      'гүнжид',
      'гахайн мах',
      'үхрийн мах',
      'согтууруулах ундаа',
    ]),
  },
};

/** 카드 문장 (언어 코드가 없으면 영어). 알레르기가 없으면 빈 문장 */
export function healthCardText(
  langCode: string,
  input: { allergens: readonly Allergen[]; bloodType?: BloodType | null; meds?: string },
): { allergy: string; blood: string | null; medsLabel: string } {
  const l = HEALTH_LANGS[langCode] ?? HEALTH_LANGS.en!;
  const list = input.allergens.map((a) => l.words[a]).join(l.sep);
  return {
    allergy: list ? l.allergy.replace('{list}', list) : '',
    blood: input.bloodType ? `${l.blood}: ${input.bloodType}` : null,
    medsLabel: l.meds,
  };
}

/**
 * 전자여행허가(입국 허가) — 개인정보에 만료일을 적어 두면 필수 항목 "비자" 줄을 자동 판단한다.
 * 나라 코드 → 허가 종류 (괌·사이판은 ESTA로도 들어간다)
 */
export const ENTRY_PERMITS = ['esta', 'etaCa', 'etaUk', 'etaAu', 'nzeta'] as const;
export type EntryPermit = (typeof ENTRY_PERMITS)[number];
export const PERMIT_FOR_COUNTRY: Record<string, EntryPermit> = {
  US: 'esta',
  GU: 'esta',
  MP: 'esta',
  CA: 'etaCa',
  GB: 'etaUk',
  AU: 'etaAu',
  NZ: 'nzeta',
};
