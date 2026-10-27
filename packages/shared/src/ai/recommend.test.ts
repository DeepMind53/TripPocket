import { describe, expect, it } from 'vitest';
import { buildRecommendations, type SourcePost, pickRadius } from './recommend';

const now = new Date('2026-10-23T00:00:00Z');
const ago = (n: number) =>
  new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');
const posts: SourcePost[] = Array.from({ length: 20 }, (_, i) => ({
  id: `p${i}`,
  title: `글 ${i}`,
  link: `https://blog.naver.com/x/${i}`,
  postdate: ago(i < 12 ? 5 + i : 70 + i),
}));

describe('AI 추천 정리', () => {
  it('없는 근거 id는 버리고, 근거가 하나도 없는 장소는 뺀다, 같은 이름은 합친다', () => {
    const r = buildRecommendations(
      [
        {
          name: '이치란',
          category: 'food',
          sourceIds: ['p0', 'p1', 'fake'],
          adSuspect: false,
          summary: '돈코츠 라멘',
        },
        { name: '이치란 ', category: 'food', sourceIds: ['p2'], adSuspect: false, summary: '' },
        { name: '유령 식당', category: 'food', sourceIds: ['nope'], adSuspect: false, summary: '' },
      ],
      posts,
      now,
    );
    expect(r.food.places.map((p) => [p.name, p.mentions])).toEqual([['이치란', 3]]);
    expect(r.food.places[0]!.sources.every((s) => s.id.startsWith('p'))).toBe(true);
  });

  it('최근 1개월에 2회↑ 장소가 5곳이면 1개월, 광고 의심은 점수 절반', () => {
    const extracted = ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({
      name,
      category: 'cafe' as const,
      sourceIds: [`p${i * 2}`, `p${i * 2 + 1}`],
      adSuspect: name === 'A',
      summary: '',
    }));
    const r = buildRecommendations(extracted, posts, now);
    expect(r.cafe.months).toBe(1);
    expect(r.cafe.enough).toBe(true);
    expect(r.cafe.places.at(-1)!.name).toBe('A');
    expect(r.play).toEqual({ months: 12, enough: false, places: [] });
  });
});

describe('가까운 곳부터 (5 → 10km)', () => {
  const at = (name: string, km: number | null) => ({ name, km });
  const km = (x: { km: number | null }) => x.km;
  it('5km 안에 3곳 이상이면 5km, 아니면 10km (10km 밖은 버림)', () => {
    expect(pickRadius([at('a', 1), at('b', 2), at('c', 4), at('d', 8)], km)).toEqual({
      radiusKm: 5,
      items: [at('a', 1), at('b', 2), at('c', 4)],
    });
    expect(pickRadius([at('a', 1), at('d', 8), at('e', 9)], km).radiusKm).toBe(10);
    expect(pickRadius([at('a', 9), at('b', 11), at('c', 30)], km)).toEqual({
      radiusKm: 10,
      items: [at('a', 9)],
    });
  });
  it('위치를 모르는 곳은 뒤에 붙인다', () => {
    expect(
      pickRadius([at('x', null), at('a', 1), at('b', 2), at('c', 3)], km).items.map((x) => x.name),
    ).toEqual(['a', 'b', 'c', 'x']);
  });
  it('기준점 위치를 알면 10km 안인지 확인 안 되는 곳은 뺀다 (2026-10-27)', () => {
    expect(
      pickRadius([at('x', null), at('a', 1)], km, 3, undefined, false).items.map((x) => x.name),
    ).toEqual(['a']);
  });
});
