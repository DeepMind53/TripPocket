import { describe, expect, it } from 'vitest';
import { countryGroups } from './savedCountries';

const p = (countryCode: string | undefined, createdAt: string) =>
  countryCode ? { countryCode, createdAt } : { createdAt };

describe('countryGroups', () => {
  it('많은 나라 먼저, 같으면 먼저 저장한 나라, 모르는 나라는 맨 뒤', () => {
    expect(
      countryGroups([
        p('TW', '2026-01-02'),
        p(undefined, '2026-01-01'),
        p('JP', '2026-01-03'),
        p('TH', '2026-01-01'),
        p('JP', '2026-01-04'),
        p(undefined, '2026-01-05'),
        p(undefined, '2026-01-06'),
      ]),
    ).toEqual([
      { code: 'JP', count: 2 },
      { code: 'TH', count: 1 },
      { code: 'TW', count: 1 },
      { code: '', count: 3 },
    ]);
  });
});
