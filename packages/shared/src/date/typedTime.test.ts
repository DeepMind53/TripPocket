import { describe, expect, it } from 'vitest';
import { parseTypedTime } from './localDate';

describe('직접 친 시간', () => {
  it.each([
    ['930', '09:30'],
    ['0930', '09:30'],
    ['9:30', '09:30'],
    ['9.30', '09:30'],
    ['9시30분', '09:30'],
    ['9시', '09:00'],
    ['21', '21:00'],
    ['2105', '21:05'],
    [' 7:5 ', '07:05'],
    ['0', '00:00'],
  ])('%s → %s', (input, out) => expect(parseTypedTime(input)).toBe(out));

  it.each(['', '24:00', '1260', '99', 'abc', '12:345'])('%s → null', (input) =>
    expect(parseTypedTime(input)).toBeNull(),
  );
});
