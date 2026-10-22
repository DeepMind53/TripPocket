import type { NewChecklistEntry } from '../../data/repositories/checklistRepo';
import type { TemplateSeed } from '../../data/repositories/templateRepo';

/**
 * 준비물·할 일 기본 템플릿 (docs/05 S-18). 처음 한 번 저장소로 복사되고, 그 뒤로는 사용자가 이름 수정·추가·삭제한다.
 * 항목 글은 사용자 데이터라 i18n이 아니라 여기 둔다.
 * 카테고리 순서 = 화면에 보이는 순서.
 */
export const CATEGORIES = ['서류', '전자기기', '의류', '세면도구', '상비약', '기타'] as const;
export type Category = (typeof CATEGORIES)[number];

const e = (category: Category, ...texts: string[]): NewChecklistEntry[] =>
  texts.map((text) => ({ text, category }));

const BASE: NewChecklistEntry[] = [
  ...e(
    '서류',
    '여권',
    '항공권(전자티켓)',
    '숙소 예약 확인서',
    '신용카드·체크카드',
    '현금(현지 통화)',
  ),
  ...e('전자기기', '휴대폰 충전기', '보조배터리', '멀티 어댑터'),
  ...e('의류', '속옷·양말', '잠옷', '편한 신발'),
  ...e('세면도구', '칫솔·치약', '화장품', '선크림'),
  ...e('상비약', '두통약·해열제', '소화제', '밴드'),
];

export interface Template {
  id: string;
  name: string;
  description: string;
  packing: NewChecklistEntry[];
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'abroad',
    name: '해외 기본',
    description: '여권·어댑터·상비약 등 어디든 필요한 것',
    packing: BASE,
  },
  {
    id: 'resort',
    name: '휴양지',
    description: '해외 기본 + 수영복·래시가드·방수팩',
    packing: [
      ...BASE,
      ...e('의류', '수영복', '래시가드', '모자', '선글라스', '슬리퍼'),
      ...e('기타', '방수팩', '아쿠아슈즈'),
      ...e('상비약', '알로에 젤(햇볕 화상)', '모기 기피제'),
    ],
  },
  {
    id: 'winter',
    name: '겨울',
    description: '해외 기본 + 패딩·내복·핫팩',
    packing: [
      ...BASE,
      ...e('의류', '패딩', '내복', '장갑', '목도리', '털모자'),
      ...e('기타', '핫팩'),
      ...e('세면도구', '립밤', '보습크림'),
    ],
  },
  {
    id: 'kids',
    name: '아이 동반',
    description: '해외 기본 + 아이 짐 (기저귀·간식·장난감)',
    packing: [
      ...BASE,
      ...e('서류', '아이 여권', '가족관계증명서(영문)'),
      ...e('기타', '기저귀·물티슈', '간식', '장난감·책', '유모차'),
      ...e('상비약', '아이용 해열제', '체온계'),
    ],
  },
];

/** 할 일 기본 제안 (docs/05 S-18) */
export const DEFAULT_TODOS: NewChecklistEntry[] = [
  { text: '여권 유효기간 확인 (6개월 이상)' },
  { text: '유심 / eSIM 준비' },
  { text: '여행자 보험 가입' },
  { text: '환전' },
  { text: '공항 가는 방법·시간 확인' },
  { text: '숙소 체크인 시간 확인' },
];

/** 처음 한 번 저장소에 복사할 기본 템플릿 */
export const TEMPLATE_SEEDS: TemplateSeed[] = [
  ...TEMPLATES.map((t) => ({ list: 'packing' as const, name: t.name, items: t.packing })),
  { list: 'todo', name: '출발 전 할 일', items: DEFAULT_TODOS },
];
