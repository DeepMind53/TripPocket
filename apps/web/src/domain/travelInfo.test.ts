import {
  fillHolidays,
  groupHolidaySpans,
  holidayFullName,
  holidayShortName,
  type Holiday,
} from './holidays';
import { formatTemps, weatherLook } from './weather';

const h = (date: string, countryCode: string, localName: string, name: string): Holiday => ({
  date,
  countryCode,
  localName,
  name,
});

describe('공휴일 이름', () => {
  it('한국은 한국어(영어), 외국은 번역이 있으면 한국어(영어), 없으면 영어', () => {
    expect(holidayFullName(h('2026-09-24', 'KR', '추석', 'Chuseok'))).toBe('추석 (Chuseok)');
    expect(holidayFullName(h('2026-02-11', 'JP', '建国記念の日', 'Foundation Day'))).toBe(
      '건국기념일 (Foundation Day)',
    );
    expect(holidayFullName(h('2026-07-04', 'US', 'Independence Day', 'Some Local Day'))).toBe(
      'Some Local Day',
    );
    expect(holidayShortName(h('2026-02-16', 'KR', '설날', 'Lunar New Year'))).toBe('설날');
    expect(holidayShortName(h('2026-11-03', 'JP', '文化の日', 'Culture Day'))).toBe('🇯🇵문화의 날');
  });

  it('이어지는 같은 공휴일은 하나로 묶는다 (설날 3일)', () => {
    const spans = groupHolidaySpans([
      h('2026-02-17', 'KR', '설날', 'Lunar New Year'),
      h('2026-02-17', 'KR', '설날', 'Lunar New Year'),
      h('2026-02-16', 'KR', '설날', 'Lunar New Year'),
      h('2026-02-18', 'KR', '설날', 'Lunar New Year'),
      h('2026-02-11', 'JP', '建国記念の日', 'Foundation Day'),
      h('2026-03-02', 'KR', '3·1절', 'Independence Movement Day'),
    ]);
    expect(spans.map((s) => [s.countryCode, s.start, s.end])).toEqual([
      ['JP', '2026-02-11', '2026-02-11'],
      ['KR', '2026-02-16', '2026-02-18'],
      ['KR', '2026-03-02', '2026-03-02'],
    ]);
  });
});

describe('공휴일 다듬기', () => {
  it('주말이라 빠진 실제 날을 채우고, 옮겨진 날은 대체공휴일', () => {
    const out = fillHolidays([
      h('2027-02-06', 'KR', '설날', 'Lunar New Year'),
      h('2027-02-08', 'KR', '설날', 'Lunar New Year'),
      h('2027-02-09', 'KR', '설날', 'Lunar New Year'),
      h('2026-08-17', 'KR', '광복절', 'Liberation Day'),
    ]);
    const by = (d: string) => out.filter((x) => x.date === d).map((x) => holidayFullName(x));
    expect(by('2027-02-07')).toEqual(['설날 (Lunar New Year)']);
    expect(by('2026-08-15')).toEqual(['광복절 (Liberation Day)']);
    expect(by('2026-08-17')).toEqual(['대체공휴일 (Substitute Holiday)']);
    expect(
      groupHolidaySpans(out.filter((x) => x.name === 'Lunar New Year')).map((s) => [
        s.start,
        s.end,
      ]),
    ).toEqual([['2027-02-06', '2027-02-09']]);
  });
});

describe('날씨', () => {
  it('WMO 코드 → 그림 종류', () => {
    expect(weatherLook(0).kind).toBe('sun');
    expect(weatherLook(3).label).toBe('흐림');
    expect(weatherLook(63).label).toBe('비');
    expect(weatherLook(73).label).toBe('눈');
    expect(weatherLook(95).label).toBe('뇌우');
  });

  it('기온 표기', () => {
    expect(formatTemps({ code: 0, min: 11.6, max: 19.4 })).toBe('12°/19°');
  });
});
