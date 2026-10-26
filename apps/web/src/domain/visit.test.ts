import { describe, expect, it } from 'vitest';
import { earlierVisits, visitPatch } from './visit';

describe('visitPatch', () => {
  it('방문은 다녀옴도 켜고, 미방문은 끈다', () => {
    expect(visitPatch({}, { visit: 'visited' })).toEqual({ visit: 'visited', done: true });
    expect(visitPatch({ done: true, visit: 'visited' }, { visit: 'skipped' })).toEqual({
      visit: 'skipped',
      done: undefined,
    });
  });

  it('기록을 지우면 다녀옴도 지운다', () => {
    expect(visitPatch({ done: true, visit: 'visited' }, { visit: null })).toEqual({
      visit: undefined,
      done: undefined,
    });
  });

  it('다녀옴만 바꾸면 방문 기록이 따라간다', () => {
    expect(visitPatch({}, { done: true })).toEqual({ done: true, visit: 'visited' });
    expect(visitPatch({ done: true, visit: 'visited' }, { done: false })).toEqual({
      done: undefined,
      visit: undefined,
    });
    expect(visitPatch({}, {})).toEqual({});
  });
});

describe('earlierVisits', () => {
  const base = { kind: 'place' as const, visit: 'visited' as const };
  const senso = {
    id: 'now',
    date: '2026-11-13',
    kind: 'place' as const,
    title: '센소지',
    place: { name: '센소지', coords: { lat: 35.7148, lng: 139.7967 } },
  };

  it('같은 장소를 예전에 방문한 기록만, 오래된 순', () => {
    const visited = [
      {
        ...base,
        id: 'b',
        date: '2025-05-02',
        title: '센소지',
        place: { name: '센소지', coords: { lat: 35.7149, lng: 139.7966 } },
      },
      { ...base, id: 'a', date: '2024-03-01', title: '센소지 ', place: { name: '센소지' } },
      {
        ...base,
        id: 'far',
        date: '2025-01-01',
        title: '센소지',
        place: { name: '센소지', coords: { lat: 34.69, lng: 135.5 } },
      },
      { ...base, id: 'skip', date: '2025-06-01', visit: 'skipped' as const, title: '센소지' },
      { ...base, id: 'later', date: '2026-12-01', title: '센소지' },
      { ...base, id: 'other', date: '2025-02-01', title: '도쿄타워' },
    ];
    expect(earlierVisits(senso, visited).map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('Google 장소 id가 같으면 이름이 달라도 같은 곳', () => {
    const v = [
      { ...base, id: 'g', date: '2025-01-01', title: 'Sensoji', place: { googlePlaceId: 'X' } },
    ];
    expect(earlierVisits({ ...senso, place: { googlePlaceId: 'X' } }, v)).toHaveLength(1);
  });

  it('메모는 기록이 없다', () => {
    expect(
      earlierVisits({ ...senso, kind: 'note' }, [
        { ...base, id: 'x', date: '2025-01-01', title: '센소지' },
      ]),
    ).toEqual([]);
  });
});
