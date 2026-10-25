/**
 * 여행 회화 (docs/20 G7) — 현지인에게 화면을 보여 주는 용도. 나라 → 언어, 언어별 자주 쓰는 10문장.
 * 번역기 바로가기용 언어 코드(파파고·Google)도 함께
 */
export const PHRASE_IDS = [
  'hello',
  'thanks',
  'excuseMe',
  'howMuch',
  'thisOne',
  'toilet',
  'bill',
  'card',
  'takeMeHere',
  'help',
] as const;
export type PhraseId = (typeof PHRASE_IDS)[number];

export interface PhraseLang {
  code: string;
  /** 화면 이름 */
  name: string;
  /** 파파고 언어 코드 (없으면 파파고 미지원) */
  papago?: string;
  /** Google 번역 언어 코드 */
  google: string;
  phrases: Record<PhraseId, string>;
}

export const KO_PHRASES: Record<PhraseId, string> = {
  hello: '안녕하세요',
  thanks: '감사합니다',
  excuseMe: '실례합니다',
  howMuch: '얼마예요?',
  thisOne: '이거 주세요',
  toilet: '화장실 어디예요?',
  bill: '계산할게요',
  card: '카드 돼요?',
  takeMeHere: '여기로 가 주세요',
  help: '도와주세요',
};

const L = (
  code: string,
  name: string,
  google: string,
  papago: string | undefined,
  p: string[],
): PhraseLang => ({
  code,
  name,
  google,
  ...(papago ? { papago } : {}),
  phrases: Object.fromEntries(PHRASE_IDS.map((id, i) => [id, p[i]!])) as Record<PhraseId, string>,
});

export const PHRASE_LANGS: readonly PhraseLang[] = [
  L('ja', '일본어', 'ja', 'ja', [
    'こんにちは',
    'ありがとうございます',
    'すみません',
    'いくらですか？',
    'これをください',
    'トイレはどこですか？',
    'お会計をお願いします',
    'カードは使えますか？',
    'ここへ行ってください',
    '助けてください',
  ]),
  L('zh-CN', '중국어(간체)', 'zh-CN', 'zh-CN', [
    '你好',
    '谢谢',
    '不好意思',
    '多少钱？',
    '我要这个',
    '洗手间在哪里？',
    '买单',
    '可以刷卡吗？',
    '请带我去这里',
    '请帮帮我',
  ]),
  L('zh-TW', '중국어(번체)', 'zh-TW', 'zh-TW', [
    '你好',
    '謝謝',
    '不好意思',
    '多少錢？',
    '我要這個',
    '洗手間在哪裡？',
    '買單',
    '可以刷卡嗎？',
    '請帶我去這裡',
    '請幫幫我',
  ]),
  L('zh-HK', '광둥어', 'yue', 'zh-TW', [
    '你好',
    '多謝',
    '唔好意思',
    '幾多錢？',
    '我要呢個',
    '洗手間喺邊度？',
    '埋單',
    '可唔可以碌卡？',
    '唔該帶我去呢度',
    '唔該幫幫我',
  ]),
  L('th', '태국어', 'th', 'th', [
    'สวัสดีครับ/ค่ะ',
    'ขอบคุณครับ/ค่ะ',
    'ขอโทษครับ/ค่ะ',
    'ราคาเท่าไหร่ครับ/คะ',
    'เอาอันนี้ครับ/ค่ะ',
    'ห้องน้ำอยู่ที่ไหนครับ/คะ',
    'เช็คบิลด้วยครับ/ค่ะ',
    'จ่ายด้วยบัตรได้ไหมครับ/คะ',
    'ช่วยไปส่งที่นี่หน่อยครับ/ค่ะ',
    'ช่วยด้วยครับ/ค่ะ',
  ]),
  L('vi', '베트남어', 'vi', 'vi', [
    'Xin chào',
    'Cảm ơn',
    'Xin lỗi',
    'Bao nhiêu tiền?',
    'Cho tôi cái này',
    'Nhà vệ sinh ở đâu?',
    'Tính tiền',
    'Trả bằng thẻ được không?',
    'Làm ơn chở tôi đến đây',
    'Giúp tôi với',
  ]),
  L('id', '인도네시아어', 'id', 'id', [
    'Halo',
    'Terima kasih',
    'Permisi',
    'Berapa harganya?',
    'Saya mau yang ini',
    'Toiletnya di mana?',
    'Minta bonnya',
    'Bisa bayar pakai kartu?',
    'Tolong antar saya ke sini',
    'Tolong bantu saya',
  ]),
  L('en', '영어', 'en', 'en', [
    'Hello',
    'Thank you',
    'Excuse me',
    'How much is it?',
    'This one, please',
    'Where is the restroom?',
    'Check, please',
    'Can I pay by card?',
    'Please take me here',
    'Please help me',
  ]),
  L('fr', '프랑스어', 'fr', 'fr', [
    'Bonjour',
    'Merci',
    'Excusez-moi',
    "C'est combien ?",
    'Je voudrais ceci',
    'Où sont les toilettes ?',
    "L'addition, s'il vous plaît",
    'Je peux payer par carte ?',
    "Emmenez-moi ici, s'il vous plaît",
    "Aidez-moi, s'il vous plaît",
  ]),
  L('it', '이탈리아어', 'it', 'it', [
    'Buongiorno',
    'Grazie',
    'Mi scusi',
    'Quanto costa?',
    'Vorrei questo',
    "Dov'è il bagno?",
    'Il conto, per favore',
    'Posso pagare con la carta?',
    'Mi porti qui, per favore',
    'Mi aiuti, per favore',
  ]),
  L('es', '스페인어', 'es', 'es', [
    'Hola',
    'Gracias',
    'Perdón',
    '¿Cuánto cuesta?',
    'Quiero esto, por favor',
    '¿Dónde está el baño?',
    'La cuenta, por favor',
    '¿Puedo pagar con tarjeta?',
    'Lléveme aquí, por favor',
    'Ayúdeme, por favor',
  ]),
  L('mn', '몽골어', 'mn', undefined, [
    'Сайн байна уу',
    'Баярлалаа',
    'Уучлаарай',
    'Хэд вэ?',
    'Үүнийг өгөөч',
    'Бие засах газар хаана байна вэ?',
    'Тооцоогоо өгөөч',
    'Картаар төлж болох уу?',
    'Намайг энд хүргэж өгнө үү',
    'Тусална уу',
  ]),
];

/** 나라 → 언어 (모르는 나라·영어권은 영어) */
const COUNTRY_LANG: Record<string, string> = {
  JP: 'ja',
  CN: 'zh-CN',
  TW: 'zh-TW',
  HK: 'zh-HK',
  MO: 'zh-HK',
  TH: 'th',
  VN: 'vi',
  ID: 'id',
  FR: 'fr',
  IT: 'it',
  ES: 'es',
  MN: 'mn',
};

export function phraseLangFor(countryCode: string | undefined): PhraseLang | undefined {
  if (!countryCode || countryCode === 'KR') return undefined;
  const code = COUNTRY_LANG[countryCode] ?? 'en';
  return PHRASE_LANGS.find((l) => l.code === code);
}

/** Google 장소 이름을 받을 때 쓸 언어 (택시 카드) */
export const placeLangFor = (countryCode: string | undefined): string | undefined => {
  const l = phraseLangFor(countryCode);
  return l ? (l.code === 'zh-HK' ? 'zh-TW' : l.code) : undefined;
};

export const papagoUrl = (lang: PhraseLang, text = '') =>
  lang.papago
    ? `https://papago.naver.com/?sk=ko&tk=${lang.papago}${text ? `&st=${encodeURIComponent(text)}` : ''}`
    : undefined;
export const googleTranslateUrl = (lang: PhraseLang, text = '') =>
  `https://translate.google.com/?sl=ko&tl=${lang.google}${text ? `&text=${encodeURIComponent(text)}` : ''}&op=translate`;
