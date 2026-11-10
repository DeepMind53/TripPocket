import { tripCardSvg, tripRange } from './tripCard';

it('요약 카드 날짜: 같은 해면 끝은 월.일, 해가 바뀌면 연도까지', () => {
  expect(tripRange('2026-11-12', '2026-11-16')).toBe('2026.11.12 – 11.16');
  expect(tripRange('2026-12-30', '2027-01-02')).toBe('2026.12.30 – 2027.01.02');
});

it('요약 카드 그림: 일차 수만큼 노선 칸, 사실 세 칸, 글자는 이스케이프', () => {
  const svg = tripCardSvg({
    title: '도쿄 <가족>',
    cities: '도쿄',
    range: '2026.11.12 – 11.16',
    days: 5,
    brand: 'TripPocket',
    facts: [
      ['일수', '5일'],
      ['장소', '14곳'],
      ['이동', '38km'],
    ],
  });
  expect(svg.match(/height="5" rx="2.5"/g)).toHaveLength(5);
  expect(svg).toContain('도쿄 &lt;가족&gt;');
  expect(svg).toContain('38km');
  expect(svg).not.toContain('var(--');
});
