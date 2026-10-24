/**
 * 법적 고지·도움말 본문 (한국어). 긴 글이라 i18n 키 대신 언어별 파일로 둔다 — 영어는 content.en.ts를 추가.
 * 운영자 연락처는 OPERATOR_CONTACT 한 곳만 바꾸면 된다. 비어 있으면 '문의' 절을 보여 주지 않는다
 * (2026-10-24 사용자 요청: 공개할 연락처를 정할 때까지 비활성화).
 */
export const OPERATOR_CONTACT: string = '';
export const UPDATED = '2026-10-23';

export interface Section {
  title: string;
  body: string[];
}

export const PRIVACY: Section[] = [
  {
    title: '1. 기본 원칙',
    body: [
      '트립포켓은 여행 일정을 이 기기(휴대폰·PC 브라우저) 안에 저장합니다. 로그인하지 않으면 여행 데이터는 운영자에게 전송되지 않습니다.',
      '현재 위치(좌표)는 서버에 저장하거나 기록하지 않습니다. 광고·분석 도구를 쓰지 않습니다.',
    ],
  },
  {
    title: '2. 로그인할 때 수집하는 정보',
    body: [
      '카카오·네이버·Google 계정의 고유 번호와 닉네임만 받습니다. 비밀번호·연락처·이메일·사진은 받지 않습니다.',
      '로그인 상태 유지를 위해 기기별 로그인 기록(만든 시각, 마지막 사용 시각, 브라우저 종류)을 저장합니다.',
      '동기화를 켜면 여행·일정·예약·준비물·템플릿을 운영자의 서버(홈 PC)에 저장해 다른 기기와 맞춥니다.',
    ],
  },
  {
    title: '3. 외부 서비스로 보내는 정보',
    body: [
      '공휴일: 나라 코드와 연도 (Nager.Date, 대만 정부 근무일 달력 — jsDelivr를 통해)',
      '날씨: 여행지 도시의 좌표 (Open-Meteo) — 내 현재 위치가 아닙니다',
      '환율: 요청만 보냄, 개인정보 없음 (한국수출입은행은 서버가 받음, 보조로 currency-api)',
      'AI 추천 수집: 기준점 이름(예: "신주쿠역")을 네이버 검색 API로. 현재 위치를 쓰면 약 100m 단위로 줄인 좌표를 가까운 역 찾기(카카오 로컬·OpenStreetMap)에만 쓰고 바로 버립니다',
      'AI 추천 정리: 기준점 이름과 블로그 공개 글의 제목·요약 앞부분만 무료 AI(Google Gemini → Mistral → Cloudflare Workers AI → Groq 순서)로 보냅니다. 내 이름·계정·위치·일정은 보내지 않습니다. Gemini·Mistral 무료 등급은 받은 내용을 서비스 개선·모델 학습에 쓸 수 있습니다',
      '길찾기·지도: 누르면 네이버 지도·Google 지도·카카오맵이 직접 열립니다 (트립포켓이 위치를 보내지 않음)',
    ],
  },
  {
    title: '4. 보관과 삭제',
    body: [
      '기기 데이터는 사용자가 지우기 전까지 기기에 남습니다 (마이 → 백업·복원으로 파일 보관 가능).',
      '회원 탈퇴 시 서버의 계정·여행 데이터는 즉시 삭제됩니다. 암호화된 서버 백업은 보관 주기(최대 약 6개월)가 지나면 자동으로 지워집니다.',
      '보기 전용 링크는 언제든 끌 수 있고, 끄면 바로 열리지 않습니다.',
    ],
  },
  {
    title: '5. 안전 조치',
    body: [
      '서버와의 통신은 HTTPS로 암호화됩니다. 세션은 해시만 저장하고, 서버 백업은 AES-256으로 암호화합니다.',
      '여행 데이터는 여행 멤버만 볼 수 있도록 서버에서 요청마다 확인합니다.',
    ],
  },
  ...(OPERATOR_CONTACT
    ? [{ title: '6. 문의', body: [`개인정보 관련 문의: ${OPERATOR_CONTACT}`] }]
    : []),
];

export const TERMS: Section[] = [
  {
    title: '1. 서비스',
    body: [
      '트립포켓은 개인이 운영하는 무료 여행 일정 앱입니다. 로그인 없이 기기 안에서 쓸 수 있고, 로그인하면 동기화·공유를 쓸 수 있습니다.',
    ],
  },
  {
    title: '2. 이용자의 책임',
    body: [
      '공휴일·날씨·환율·AI 추천 정보는 참고용입니다. 환전·예약·이동 전에는 공식 정보를 확인하세요.',
      '다른 사람의 개인정보나 권리를 침해하는 내용을 공유하지 마세요.',
    ],
  },
  {
    title: '3. 서비스 변경과 중단',
    body: [
      '서버는 운영자의 개인 컴퓨터에서 동작해 예고 없이 멈출 수 있습니다. 서버가 멈춰도 기기 안의 데이터와 앱은 그대로 쓸 수 있습니다.',
      '중요한 일정은 백업 파일로도 보관해 주세요.',
    ],
  },
  ...(OPERATOR_CONTACT ? [{ title: '4. 문의', body: [OPERATOR_CONTACT] }] : []),
];

/** 데이터·글꼴·이미지 출처 (라이선스상 표기가 필요한 것) */
export const DATA_SOURCES: { name: string; use: string; license: string; url: string }[] = [
  {
    name: 'Twemoji (Twitter)',
    use: '국기 이모지 글꼴 (Windows)',
    license: 'CC BY 4.0',
    url: 'https://github.com/twitter/twemoji',
  },
  {
    name: 'Pretendard',
    use: '글꼴',
    license: 'SIL Open Font License 1.1',
    url: 'https://github.com/orioncactus/pretendard',
  },
  {
    name: 'GeoNames',
    use: '한국·일본·대만 시·군·정·촌 목록',
    license: 'CC BY 4.0',
    url: 'https://www.geonames.org',
  },
  {
    name: 'OpenStreetMap',
    use: '해외 가까운 역 찾기',
    license: '© OpenStreetMap contributors, ODbL',
    url: 'https://www.openstreetmap.org/copyright',
  },
  { name: 'Open-Meteo', use: '날씨 예보', license: 'CC BY 4.0', url: 'https://open-meteo.com' },
  { name: 'Nager.Date', use: '공휴일', license: 'MIT', url: 'https://date.nager.at' },
  {
    name: '행정원 인사행정총처 (TaiwanCalendar 경유)',
    use: '대만 공휴일',
    license: '대만 정부 오픈데이터 이용 조건',
    url: 'https://data.gov.tw',
  },
  {
    name: 'Google 캘린더 공휴일',
    use: '태국·말레이시아 공휴일 (앱에 포함)',
    license: 'Google',
    url: 'https://calendar.google.com',
  },
  {
    name: '한국수출입은행',
    use: '환율 (매매기준율)',
    license: '공공데이터',
    url: 'https://www.koreaexim.go.kr',
  },
  {
    name: 'currency-api (fawazahmed0)',
    use: '환율 보조',
    license: 'CC0 1.0',
    url: 'https://github.com/fawazahmed0/exchange-api',
  },
  {
    name: '네이버 검색 API',
    use: 'AI 추천 블로그 수집',
    license: '네이버 개발자 이용약관',
    url: 'https://developers.naver.com',
  },
  {
    name: 'NAVER API HUB (네이버 클라우드)',
    use: '블로그·지역 검색',
    license: '네이버 클라우드 이용약관',
    url: 'https://www.ncloud.com',
  },
  {
    name: 'Google Gemini API · Mistral AI · Cloudflare Workers AI · Groq',
    use: 'AI 추천 정리 (무료 등급, 이 순서로 시도)',
    license: '각 서비스 이용약관',
    url: 'https://ai.google.dev',
  },
  {
    name: '카카오 로컬 API',
    use: '국내 가까운 역 찾기',
    license: '카카오 개발자 이용약관',
    url: 'https://developers.kakao.com',
  },
];

export const HELP: Section[] = [
  {
    title: '인터넷이 없어도 되나요?',
    body: [
      '네. 홈 화면에 앱을 설치하면(마이 → 홈 화면에 앱 설치) 비행기 모드에서도 일정·예약·준비물을 보고 고칠 수 있어요.',
    ],
  },
  {
    title: '데이터는 어디에 저장되나요?',
    body: [
      '이 기기 안에 저장돼요. 휴대폰을 바꾸거나 잃어버릴 때를 대비해 마이 → 백업·복원에서 가끔 백업 파일을 만들어 두세요.',
      '로그인하면 계정에도 저장되어 다른 기기에서 이어서 볼 수 있어요.',
    ],
  },
  {
    title: '카톡에서 열었더니 경고가 나와요',
    body: [
      '카톡·인스타 안의 브라우저는 데이터가 사라질 수 있어요. [다른 브라우저로 열기]를 눌러 Safari나 Chrome에서 열어 주세요.',
    ],
  },
  {
    title: '일행과 일정을 같이 보려면?',
    body: [
      '여행 화면 ⋯ → 공유·내보내기: 텍스트·이미지로 보내거나, 로그인 후 보기 전용 링크(받는 사람은 로그인 없이)나 초대 링크(함께 편집)를 만들 수 있어요.',
    ],
  },
  {
    title: '길찾기 앱을 매번 고르기 귀찮아요',
    body: ['설정 → 지도·길찾기 → 기본 길찾기 앱을 고르면 바로 열려요.'],
  },
];
