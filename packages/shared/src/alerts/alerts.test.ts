import { describe, expect, it } from 'vitest';
import { WEATHER_WARNING_LINKS, warningLinkFor } from './alerts';
import { COUNTRY_ESSENTIALS } from '../data/essentials';

describe('나라별 특보 링크', () => {
  it('입국 정보가 있는 나라는 모두 그 나라 기상청 링크가 있다', () => {
    const codes = COUNTRY_ESSENTIALS.flatMap((c) => c.codes);
    for (const c of [...codes, 'KR']) expect(WEATHER_WARNING_LINKS[c], c).toBeDefined();
  });
  it('모르는 나라는 WMO로', () => {
    expect(warningLinkFor('ZZ').url).toContain('severeweather.wmo.int');
  });
});
