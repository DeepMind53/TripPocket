import { addDays, flagEmoji, type LocalDate } from '@trippocket/shared';

/** 공휴일 하나 (Nager.Date 응답을 줄인 것) */
export interface Holiday {
  date: LocalDate;
  countryCode: string;
  /** 현지 이름 (한국은 한국어) */
  localName: string;
  /** 영어 이름 */
  name: string;
}

/**
 * 외국 공휴일의 한국어 이름 (자주 나오는 것만). 없으면 영어만 보여준다.
 * 키는 Nager.Date의 영어 이름.
 */
const KO_NAMES: Record<string, string> = {
  "New Year's Day": '새해 첫날',
  'Christmas Day': '크리스마스',
  'Good Friday': '성금요일',
  'Easter Monday': '부활절 월요일',
  'Easter Sunday': '부활절',
  'Labour Day': '노동절',
  'Labor Day': '노동절',
  "International Workers' Day": '노동절',
  'National Day': '국경일',
  'Independence Day': '독립기념일',
  // 일본
  'Coming of Age Day': '성인의 날',
  'Foundation Day': '건국기념일',
  'National Foundation Day': '건국기념일',
  "The Emperor's Birthday": '천황 탄생일',
  "Emperor's Birthday": '천황 탄생일',
  'Vernal Equinox Day': '춘분의 날',
  'Shōwa Day': '쇼와의 날',
  'Showa Day': '쇼와의 날',
  'Constitution Memorial Day': '헌법기념일',
  'Greenery Day': '녹색의 날',
  "Children's Day": '어린이날',
  'Marine Day': '바다의 날',
  'Mountain Day': '산의 날',
  'Respect for the Aged Day': '경로의 날',
  'Autumnal Equinox Day': '추분의 날',
  'Sports Day': '스포츠의 날',
  'Culture Day': '문화의 날',
  'Labour Thanksgiving Day': '근로 감사의 날',
  // 중화권
  'Chinese New Year': '춘절',
  'Chinese New Year (Spring Festival)': '춘절',
  'Spring Festival': '춘절',
  'Lunar New Year': '설날',
  // 대만 (TaiwanCalendar)
  'Founding Day of the Republic of China': '중화민국 개국기념일',
  'Peace Memorial Day': '평화기념일',
  'Tomb Sweeping Day': '청명절',
  "Teachers' Day": '스승의 날',
  'Retrocession Day': '광복절',
  'Qingming Festival': '청명절',
  'Ching Ming Festival': '청명절',
  'Dragon Boat Festival': '단오절',
  'Tuen Ng Festival': '단오절',
  'Mid-Autumn Festival': '중추절',
  'Chung Yeung Festival': '중양절',
  "Buddha's Birthday": '부처님 오신 날',
  // 동남아
  Songkran: '송끄란',
  'Makha Bucha': '마카부차',
  'Visakha Bucha': '위사카부차',
  'Asalha Bucha': '아산하부차',
  'Chakri Day': '짜끄리 왕조 기념일',
  'Coronation Day': '대관식 기념일',
  'Chulalongkorn Day': '쭐랄롱꼰 대왕 기념일',
  'Royal Ploughing Ceremony Day': '왕실 쟁기질 의식의 날',
  "King Vajiralongkorn's Birthday": '국왕 탄신일',
  "King Bhumibol's Birthday": '푸미폰 국왕 탄신일 (아버지의 날)',
  "Queen Suthida's Birthday": '수티다 왕비 탄신일',
  "The Queen Mother's Birthday": '왕대비 탄신일 (어머니의 날)',
  'Anniversary of the Death of King Bhumibol': '푸미폰 국왕 서거일',
  'Constitution Day': '제헌절',
  'New Year Special': '새해 특별 휴일',
  "New Year's Eve": '연말 휴일',
  "Chinese New Year's Day": '춘절',
  'Wesak Day': '석가탄신일',
  'Malaysia Day': '말레이시아의 날',
  "Malaysia's National Day": '독립기념일',
  "The Yang di-Pertuan Agong's Birthday": '국왕 탄신일',
  Muharram: '이슬람 새해',
  "The Prophet Muhammad's Birthday": '무함마드 탄신일',
  'Hari Raya Puasa': '하리 라야 푸아사',
  'Hari Raya Haji': '하리 라야 하지',
  Deepavali: '디파발리',
  'Vesak Day': '석가탄신일',
  'Hung Kings Commemoration Day': '흥왕 기념일',
  'Reunification Day': '통일의 날',
  'Rizal Day': '리살 기념일',
  "All Saints' Day": '만성절',
};

/** 한국 공휴일은 "설날 (Lunar New Year)", 외국은 "건국기념일 (National Foundation Day)" 또는 영어만 */
export function holidayLabel(h: Holiday): { ko: string | null; en: string } {
  if (h.countryCode === 'KR') return { ko: h.localName, en: h.name };
  if (h.name === 'Substitute Holiday') return { ko: '대체공휴일', en: h.name };
  if (h.name === 'Bridge Holiday') return { ko: '임시공휴일', en: h.name };
  return { ko: KO_NAMES[h.name] ?? null, en: h.name };
}

export function holidayFullName(h: Holiday): string {
  const { ko, en } = holidayLabel(h);
  return ko ? `${ko} (${en})` : en;
}

/** 칸 아래 짧은 이름: 한국어가 있으면 한국어, 없으면 영어. 외국 공휴일은 앞에 국기 */
export function holidayShortName(h: Holiday): string {
  const name = holidayLabel(h).ko ?? h.name;
  return h.countryCode === 'KR' ? name : `${flagEmoji(h.countryCode)}${name}`;
}

export interface HolidaySpan {
  countryCode: string;
  start: LocalDate;
  end: LocalDate;
  holiday: Holiday;
}

/**
 * 같은 나라·같은 이름이 이어지는 날을 하나로 묶는다 (설날 2.16–2.18 처럼)
 * 입력은 날짜순이 아니어도 된다.
 */
export function groupHolidaySpans(list: readonly Holiday[]): HolidaySpan[] {
  const sorted = [...list].sort(
    (a, b) => a.countryCode.localeCompare(b.countryCode) || a.date.localeCompare(b.date),
  );
  const spans: HolidaySpan[] = [];
  for (const h of sorted) {
    const last = spans.at(-1);
    // 같은 날 같은 공휴일이 두 번 오면 (중복 응답) 한 번만
    if (
      last &&
      last.countryCode === h.countryCode &&
      last.holiday.name === h.name &&
      last.end === h.date
    )
      continue;
    if (
      last &&
      last.countryCode === h.countryCode &&
      last.holiday.name === h.name &&
      addDays(last.end, 1) === h.date
    ) {
      last.end = h.date;
    } else {
      spans.push({ countryCode: h.countryCode, start: h.date, end: h.date, holiday: h });
    }
  }
  // 화면에는 날짜순 (같은 날이면 한국 먼저)
  return spans.sort(
    (a, b) =>
      a.start.localeCompare(b.start) ||
      Number(b.countryCode === 'KR') - Number(a.countryCode === 'KR'),
  );
}

/** 한국 양력 고정 공휴일 (Nager.Date는 주말에 겹치면 실제 날 대신 대체공휴일 날짜만 준다) */
const KR_FIXED: Record<string, string> = {
  "New Year's Day": '01-01',
  'Independence Movement Day': '03-01',
  "Children's Day": '05-05',
  'Memorial Day': '06-06',
  'Constitution Day': '07-17',
  'Liberation Day': '08-15',
  'National Foundation Day': '10-03',
  'Hangul Day': '10-09',
  'Christmas Day': '12-25',
};

/**
 * 받은 공휴일 목록을 달력에 맞게 다듬는다.
 * - 한국 고정 공휴일이 다른 날로 왔으면: 실제 날에 그 공휴일, 받은 날은 "대체공휴일"
 * - 같은 이름 사이에 하루가 빠졌으면 채운다 (2027 설날 2.6·(2.7 일요일 빠짐)·2.8)
 */
export function fillHolidays(list: readonly Holiday[]): Holiday[] {
  const out: Holiday[] = [];
  for (const h of list) {
    const fixed = h.countryCode === 'KR' ? KR_FIXED[h.name] : undefined;
    if (fixed && h.date.slice(5) !== fixed) {
      out.push({ ...h, date: `${h.date.slice(0, 4)}-${fixed}` });
      out.push({ ...h, localName: '대체공휴일', name: 'Substitute Holiday' });
    } else out.push(h);
  }
  const has = new Set(out.map((h) => `${h.countryCode}|${h.name}|${h.date}`));
  for (const h of [...out]) {
    const gap = addDays(h.date, 1);
    const key = (d: string) => `${h.countryCode}|${h.name}|${d}`;
    if (!has.has(key(gap)) && has.has(key(addDays(h.date, 2)))) {
      has.add(key(gap));
      out.push({ ...h, date: gap });
    }
  }
  return out;
}
