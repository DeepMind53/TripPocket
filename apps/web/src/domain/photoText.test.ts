import { needsTranslation, placeBox } from './photoText';

it('번역이 필요한지: 한글이 절반을 넘으면 그대로', () => {
  expect(needsTranslation(['ラーメン ¥980', '合計 ¥980'])).toBe(true);
  expect(needsTranslation(['Coffee 4.50', 'Total 4.50'])).toBe(true);
  expect(needsTranslation(['아메리카노 4,500', '합계 4,500'])).toBe(false);
  // 숫자만이면 번역할 것이 없다
  expect(needsTranslation(['4,500', '12:30'])).toBe(false);
});

it('상자 자리: 사진 크기 대비 %, 기울기는 도', () => {
  const p = placeBox({ cx: 500, cy: 250, w: 400, h: 40, a: Math.PI / 36 }, 1000, 1000);
  expect(p).toMatchObject({ left: 50, top: 25, width: 40, height: 4 });
  expect(p.fontCqw).toBeCloseTo(3);
  expect(p.deg).toBeCloseTo(5);
});
