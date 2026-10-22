import { describe, expect, it } from 'vitest';
import { allCities, choseong, flagEmoji, normalize, searchPlaces } from './places';

const names = (q: string) => searchPlaces(q).map((h) => (h.kind === 'city' ? h.ko : `[${h.ko}]`));

describe('도시·국가 검색', () => {
  it('한글·영어 모두 찾는다', () => {
    expect(names('도쿄')[0]).toBe('도쿄');
    expect(names('tokyo')[0]).toBe('도쿄');
    expect(names('TOKYO')[0]).toBe('도쿄');
    expect(names('kuala lumpur')[0]).toBe('쿠알라룸푸르');
  });

  it('별칭과 악센트 없는 표기', () => {
    expect(names('사이공')[0]).toBe('호치민');
    expect(names('동경')[0]).toBe('도쿄');
    expect(names('zurich')[0]).toBe('취리히');
    expect(names('cesky')[0]).toBe('체스키크룸로프');
  });

  it('국가로 찾으면 국가가 맨 위, 그 나라 도시가 뒤에', () => {
    const hits = searchPlaces('일본');
    expect(hits[0]).toMatchObject({ kind: 'country', countryCode: 'JP', timezone: 'Asia/Tokyo' });
    expect(searchPlaces('japan')[0]).toMatchObject({ kind: 'country', countryCode: 'JP' });
    expect(searchPlaces('vietnam')[0]).toMatchObject({ kind: 'country', countryCode: 'VN' });
  });

  it('초성 검색', () => {
    expect(choseong('도쿄')).toBe('ㄷㅋ');
    expect(names('ㄷㅋ')).toContain('도쿄');
    expect(names('ㅂㄹㅅㄹㄴ')[0]).toBe('바르셀로나');
  });

  it('앞부분이 맞는 게 중간에 들어간 것보다 먼저', () => {
    const hits = names('파리');
    expect(hits[0]).toBe('파리');
  });

  it('도시 결과에 좌표·시간대·국가 이름이 있다', () => {
    expect(searchPlaces('다낭')[0]).toMatchObject({
      kind: 'city',
      countryCode: 'VN',
      timezone: 'Asia/Ho_Chi_Minh',
      countryKo: '베트남',
    });
  });

  it('없는 곳·빈 검색어', () => {
    expect(searchPlaces('')).toEqual([]);
    expect(searchPlaces('없는도시이름')).toEqual([]);
  });

  it('정규화·국기', () => {
    expect(normalize(' São-Paulo ')).toBe('saopaulo');
    expect(flagEmoji('JP')).toBe('🇯🇵');
  });

  it('아시아 도시 확장: 한국 시·군, 일본·대만·중국 주요 도시', () => {
    expect(names('용인')[0]).toBe('용인');
    expect(names('김포')[0]).toBe('김포');
    expect(names('gimpo')[0]).toBe('김포');
    expect(names('에버랜드')[0]).toBe('용인');
    expect(names('강남')[0]).toBe('서울');
    expect(names('광주')[0]).toBe('광주');
    expect(names('광주')).toContain('경기 광주');
    expect(names('고성')).toEqual(expect.arrayContaining(['강원 고성', '경남 고성']));
    expect(names('지우펀')[0]).toBe('신베이');
    expect(names('연길')[0]).toBe('옌지');
    expect(names('다카야마')[0]).toBe('다카야마');
    expect(names('후에')[0]).toBe('후에');
  });

  it('데이터 품질: 같은 이름·국가 중복 없음, 좌표·시간대 형식', () => {
    const all = allCities();
    const keys = all.map((c) => `${c.ko}|${c.countryCode}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of all) {
      expect(c.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lng)).toBeLessThanOrEqual(180);
      expect(() => new Intl.DateTimeFormat('en', { timeZone: c.timezone })).not.toThrow();
    }
    // 한국 도시 좌표는 한반도 범위 안
    for (const c of all.filter((x) => x.countryCode === 'KR')) {
      expect(c.lat).toBeGreaterThan(33);
      expect(c.lat).toBeLessThan(38.7);
      expect(c.lng).toBeGreaterThan(124.5);
      expect(c.lng).toBeLessThan(131);
    }
    expect(all.length).toBeGreaterThan(500);
  });
});

describe('전체 도시 (GeoNames 생성 데이터)', () => {
  const names = (q: string) => searchPlaces(q).map((h) => h.ko);
  it('한국·일본·대만 작은 도시도 찾는다', () => {
    expect(names('울주')[0]).toBe('울주');
    expect(names('가루이자와')[0]).toBe('가루이자와');
    expect(names('하코네')[0]).toBe('하코네');
    expect(names('비에이')[0]).toBe('비에이');
    expect(names('루이팡')[0]).toBe('루이팡');
  });
  it('구 이름으로 소속 도시를 찾는다', () => {
    expect(names('강남구')[0]).toBe('서울');
    expect(names('신주쿠')[0]).toBe('도쿄');
  });
  it('나라 이름을 정확히 치면 그 나라 도시가 전부 나온다', () => {
    const hits = searchPlaces('일본');
    expect(hits[0]).toMatchObject({ kind: 'country', countryCode: 'JP' });
    expect(hits.filter((h) => h.kind === 'city' && h.countryCode === 'JP').length).toBeGreaterThan(
      1000,
    );
    expect(searchPlaces('일').length).toBeLessThanOrEqual(20);
  });
});

describe('공항·관광지', () => {
  const names = (q: string) => searchPlaces(q).map((h) => h.ko);
  it('공항 이름·코드로 도시를 찾는다', () => {
    expect(names('나리타공항')[0]).toBe('도쿄');
    expect(names('수완나품')[0]).toBe('방콕');
    expect(names('icn')[0]).toBe('인천');
  });
  it('추가 관광지', () => {
    expect(names('시안')[0]).toBe('시안');
    expect(names('앤털로프캐니언')[0]).toBe('페이지');
  });
});
