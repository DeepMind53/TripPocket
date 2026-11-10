import { stampLook } from '../../shared/ui';
import { stampSheetSvg } from './stampSheet';

it('도장 이미지: 나라마다 화면 도장과 같은 기울기·실제 색, 글자는 이스케이프', () => {
  const svg = stampSheetSvg(
    [
      { city: '일본', period: '3번', seed: 'JP' },
      { city: 'A&B', period: '1번', seed: 'XX' },
    ],
    '가 본 나라',
  );
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  expect(svg).toContain(`rotate(${stampLook('JP', '일본').rotate} 40 40)`);
  expect(svg).toContain('color="#2c64ed"');
  expect(svg).toContain('A&amp;B');
  expect(svg).not.toContain('var(--');
});
