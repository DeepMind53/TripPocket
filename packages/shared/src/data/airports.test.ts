import { describe, expect, it } from 'vitest';
import { findAirport, searchAirports } from './airports';

describe('공항 찾기', () => {
  it('IATA 코드(대소문자 무관)가 정확하면 맨 앞', () => {
    expect(searchAirports('nrt')[0]?.iata).toBe('NRT');
    expect(findAirport(' icn ')?.name).toBe('인천국제공항');
  });
  it('도시 이름으로 그 도시 공항들', () => {
    expect(searchAirports('도쿄').map((a) => a.iata)).toEqual(['NRT', 'HND']);
    expect(
      searchAirports('오사카')
        .map((a) => a.iata)
        .sort(),
    ).toEqual(['ITM', 'KIX']);
  });
  it('공항 이름 일부·영어 이름', () => {
    expect(searchAirports('간사이')[0]?.iata).toBe('KIX');
    expect(searchAirports('changi')[0]?.iata).toBe('SIN');
  });
  it('코드가 겹치지 않는다', () => {
    const all = searchAirports('공항', 500).map((a) => a.iata);
    expect(new Set(all).size).toBe(all.length);
  });
});
