import { describe, expect, it } from 'vitest';
import { visitPatch } from './visit';

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
