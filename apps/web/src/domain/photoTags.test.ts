import { photoTag } from './photoTags';

it('사진 분류: 점수 높은 이름부터 처음 맞는 묶음, 없으면 기타', () => {
  expect(
    photoTag([
      { name: 'Ramen', score: 0.9 },
      { name: 'Tableware', score: 0.8 },
    ]),
  ).toBe('food');
  expect(
    photoTag([
      { name: 'Sky', score: 0.7 },
      { name: 'Temple', score: 0.95 },
    ]),
  ).toBe('building');
  expect(photoTag([{ name: 'Mountain', score: 0.9 }])).toBe('scenery');
  expect(photoTag([{ name: 'Smile', score: 0.9 }])).toBe('people');
  expect(photoTag([{ name: 'Font', score: 0.9 }])).toBe('other');
  expect(photoTag([])).toBe('other');
});
