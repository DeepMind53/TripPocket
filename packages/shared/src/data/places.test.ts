import { describe, expect, it } from 'vitest';
import { choseong, flagEmoji, normalize, searchPlaces } from './places';

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
});
