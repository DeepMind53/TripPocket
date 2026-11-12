/**
 * 나라별 교통카드·승차권·토큰 (빠른 메뉴 "현지 정보", 사용자 요청 2026-11-03):
 * 누르면 사진 + 공식 안내. 사진은 위키미디어 공용의 자유 이용 사진(크기만 줄임, public/transit/),
 * 쓸 만한 사진이 없는 카드는 색과 이름으로 그린 카드를 보여 준다 (상표 로고는 그리지 않음).
 * 월간 갱신에서 사진·링크를 다시 확인한다 (TRANSIT_CARDS_CHECKED_AT)
 */
export interface TransitCard {
  id: string;
  name: string;
  /** 충전식 카드 / 종이 승차권 / 1회용 토큰 */
  kind?: 'ticket' | 'token';
  /** 공식 안내 */
  url: string;
  /** 사진이 없을 때 그린 카드 색 */
  color: string;
  photo?: { src: string; author: string; license: string; page: string };
}

export const TRANSIT_CARDS_CHECKED_AT = '2026-11-03';

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;

const CARDS: Record<string, TransitCard> = {
  suica: {
    id: 'suica',
    name: '스이카 (Suica)',
    url: 'https://www.jreast.co.jp/suica/',
    color: '#2e9e4f',
    photo: {
      src: '/transit/suica.jpg',
      author: 'Ravi Dwivedi',
      license: 'CC BY-SA 4.0',
      page: commons('Welcome_Suica.jpg'),
    },
  },
  pasmo: { id: 'pasmo', name: '파스모 (PASMO)', url: 'https://www.pasmo.co.jp', color: '#e4007f' },
  icoca: {
    id: 'icoca',
    name: '이코카 (ICOCA)',
    url: 'https://www.jr-odekake.net/icoca/',
    color: '#1d6fb8',
    photo: {
      src: '/transit/icoca.jpg',
      author: 'Mc681',
      license: 'CC BY-SA 4.0',
      page: commons('SMART_ICOCA_IC_card_back.jpg'),
    },
  },
  easycard: {
    id: 'easycard',
    name: '이지카드 (悠遊卡)',
    url: 'https://www.easycard.com.tw',
    color: '#2b6cb0',
    photo: {
      src: '/transit/easycard.jpg',
      author: '01x07x2022000',
      license: 'CC0',
      page: commons('EasyCard_2019.JPG'),
    },
  },
  ipass: {
    id: 'ipass',
    name: '아이패스 (一卡通)',
    url: 'https://www.i-pass.com.tw',
    color: '#f08c00',
    photo: {
      src: '/transit/ipass.jpg',
      author: 'Solomon203',
      license: 'CC BY-SA 4.0',
      page: commons('IPASS_Adult_53500043099_back.jpg'),
    },
  },
  octopus: {
    id: 'octopus',
    name: '옥토퍼스 (Octopus)',
    url: 'https://www.octopus.com.hk',
    color: '#f39800',
  },
  macaupass: {
    id: 'macaupass',
    name: '마카오패스 (Macau Pass)',
    url: 'https://www.macaupass.com',
    color: '#e8452c',
    photo: {
      src: '/transit/macaupass.jpg',
      author: 'Enviro2800',
      license: 'CC BY-SA 4.0',
      page: commons('4th_Generation_Macau_Pass_Card_2025.jpg'),
    },
  },
  ezlink: {
    id: 'ezlink',
    name: '이지링크 (EZ-Link)',
    url: 'https://www.ezlink.com.sg',
    color: '#3f8fd2',
    photo: {
      src: '/transit/ezlink.jpg',
      author: 'Kalleboo',
      license: 'CC BY 2.0',
      page: commons('Ez-Link_front_and_back.jpg'),
    },
  },
  rabbit: {
    id: 'rabbit',
    name: '래빗카드 (Rabbit)',
    url: 'https://www.rabbit.co.th',
    color: '#f7941d',
    photo: {
      src: '/transit/rabbit.jpg',
      author: 'Karl Baron',
      license: 'CC BY 2.0',
      page: commons('Adult_Rabbit_card.jpg'),
    },
  },
  touchngo: {
    id: 'touchngo',
    name: "터치앤고 (Touch 'n Go)",
    url: 'https://www.touchngo.com.my',
    color: '#005abb',
  },
  beep: { id: 'beep', name: '비프 카드 (beep)', url: 'https://www.beep.com.ph', color: '#0095d9' },
  omny: {
    id: 'omny',
    name: 'OMNY (뉴욕)',
    url: 'https://omny.info',
    color: '#111111',
    photo: {
      src: '/transit/omny.jpg',
      author: 'Schvaxet',
      license: 'CC BY-SA 4.0',
      page: commons('OMNY_Card.jpg'),
    },
  },
  oyster: {
    id: 'oyster',
    name: '오이스터 (Oyster)',
    url: 'https://tfl.gov.uk/fares/how-to-pay-and-where-to-buy-tickets-and-oyster',
    color: '#0019a8',
    photo: {
      src: '/transit/oyster.jpg',
      author: 'Oxyman',
      license: 'CC BY 2.5',
      page: commons('TfL_Oyster_Card_back.jpg'),
    },
  },
  navigo: {
    id: 'navigo',
    name: '나비고 이지 (Navigo Easy)',
    url: 'https://www.iledefrance-mobilites.fr',
    color: '#4bacd6',
    photo: {
      src: '/transit/navigo.jpg',
      author: 'DominikPeters',
      license: 'CC0',
      page: commons('Navigo_Easy_card.jpg'),
    },
  },
  opal: {
    id: 'opal',
    name: '오팔 (Opal, 시드니)',
    url: 'https://transportnsw.info/tickets-fares/opal',
    color: '#222222',
  },
  myki: {
    id: 'myki',
    name: '마이키 (myki, 멜버른)',
    url: 'https://www.ptv.vic.gov.au/tickets/myki/',
    color: '#c2d500',
  },
  'jp-shinkansen': {
    id: 'jp-shinkansen',
    name: '신칸센 승차권',
    kind: 'ticket',
    url: 'https://global.jr-central.co.jp/ko/',
    color: '#5aa9c8',
    photo: {
      src: '/transit/jp-shinkansen.jpg',
      author: 'Marek Ślusarczyk (Tupungato)',
      license: 'CC BY 3.0',
      page: commons('011_Shinkansen_train_ticket_from_Kyoto_to_Tokyo.jpg'),
    },
  },
  'jp-metro': {
    id: 'jp-metro',
    name: '도쿄 메트로 1회권',
    kind: 'ticket',
    url: 'https://www.tokyometro.jp/kr/',
    color: '#009bbf',
    photo: {
      src: '/transit/jp-metro.jpg',
      author: 'Ominae',
      license: 'CC BY-SA 4.0',
      page: commons('Tokyo_Metro_ticket_with_Shinjuku_Sanchome_20161026.jpg'),
    },
  },
  'tw-token': {
    id: 'tw-token',
    name: '타이베이 MRT 1회용 토큰',
    kind: 'token',
    url: 'https://www.metro.taipei',
    color: '#6b5ba8',
    photo: {
      src: '/transit/tw-token.jpg',
      author: 'Geographyinitiative',
      license: 'CC0',
      page: commons('Taipei_Metro_single-journey_tokens_071_and_101_-_1.jpg'),
    },
  },
  'tw-hsr': {
    id: 'tw-hsr',
    name: '대만 고속철 승차권',
    kind: 'ticket',
    url: 'https://www.thsrc.com.tw',
    color: '#f26b21',
    photo: {
      src: '/transit/tw-hsr.jpg',
      author: 'YJJcoolcool',
      license: 'CC BY-SA 4.0',
      page: commons('Taiwan_High_Speed_Rail_Paper_Ticket_-_July_2023.jpg'),
    },
  },
  'hk-ticket': {
    id: 'hk-ticket',
    name: 'MTR 1회권',
    kind: 'ticket',
    url: 'https://www.mtr.com.hk',
    color: '#c41e3a',
    photo: {
      src: '/transit/hk-ticket.jpg',
      author: 'Fdggcey9',
      license: 'CC BY-SA 4.0',
      page: commons('HK_港鐵_MTR_成人單程票_Adult_Single_Journey_ticket_2019-07-28_Sheung_Wan.jpg'),
    },
  },
  'th-token': {
    id: 'th-token',
    name: '방콕 MRT 1회용 토큰',
    kind: 'token',
    url: 'https://metro.bemplc.co.th',
    color: '#1f3c88',
    photo: {
      src: '/transit/th-token.jpg',
      author: 'Mopza',
      license: 'CC BY-SA 4.0',
      page: commons('MRT_Token.jpg'),
    },
  },
  'my-token': {
    id: 'my-token',
    name: '래피드KL 1회용 토큰',
    kind: 'token',
    url: 'https://myrapid.com.my',
    color: '#0c66b3',
    photo: {
      src: '/transit/my-token.jpg',
      author: '*angys*',
      license: 'CC BY-SA 4.0',
      page: commons('Rapid_KL_single_journey_token_(220713).jpg'),
    },
  },
  'cn-metro': {
    id: 'cn-metro',
    name: '상하이 지하철 1회권',
    kind: 'ticket',
    url: 'https://www.shmetro.com',
    color: '#e60012',
    photo: {
      src: '/transit/cn-metro.jpg',
      author: 'Shwangtianyuan',
      license: 'CC BY-SA 4.0',
      page: commons('Shanghai_Metro_Single_Journey_Ticket_with_QR_code-20260812.jpg'),
    },
  },
  'gb-ticket': {
    id: 'gb-ticket',
    name: '영국 기차표',
    kind: 'ticket',
    url: 'https://www.nationalrail.co.uk',
    color: '#f47b20',
    photo: {
      src: '/transit/gb-ticket.jpg',
      author: 'Allegutennamen',
      license: 'CC0',
      page: commons('National_Rail_Ticket_New_Layout.png'),
    },
  },
};

const BY_COUNTRY: Record<string, readonly string[]> = {
  JP: ['suica', 'pasmo', 'icoca', 'jp-metro', 'jp-shinkansen'],
  TW: ['easycard', 'ipass', 'tw-token', 'tw-hsr'],
  HK: ['octopus', 'hk-ticket'],
  MO: ['macaupass'],
  SG: ['ezlink'],
  TH: ['rabbit', 'th-token'],
  MY: ['touchngo', 'my-token'],
  PH: ['beep'],
  CN: ['cn-metro'],
  US: ['omny'],
  GB: ['oyster', 'gb-ticket'],
  FR: ['navigo'],
  AU: ['opal', 'myki'],
};

/** 나라 코드 → 교통카드·승차권 목록 (없으면 빈 배열) */
export function transitCardsFor(country: string): TransitCard[] {
  return (BY_COUNTRY[country] ?? []).flatMap((id) => (CARDS[id] ? [CARDS[id]] : []));
}

/** 도시 정보에 적은 카드 id 순서대로 (없는 id는 건너뜀) */
export const transitCardsByIds = (ids: readonly string[]): TransitCard[] =>
  ids.flatMap((id) => (CARDS[id] ? [CARDS[id]] : []));

/** 출처 표기·시험용: 사진이 있는 카드 전부 */
export const TRANSIT_CARD_PHOTOS = Object.values(CARDS).filter((c) => c.photo);
