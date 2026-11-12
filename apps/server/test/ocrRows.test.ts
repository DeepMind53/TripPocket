import { describe, expect, it } from 'vitest';
import { aPoly, gPoly, rowsFromBoxes, type TextBox } from '../src/services/ocrRows';

/** 가로 글자 상자 (x, y = 왼쪽 위, 기울기 a 라디안) */
function box(text: string, x: number, y: number, w: number, h = 20, a = 0): TextBox {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const at = (dx: number, dy: number) => ({ x: x + dx * c - dy * s, y: y + dx * s + dy * c });
  return { text, poly: [at(0, 0), at(w, 0), at(w, h), at(0, h)] };
}

describe('영수증 글자 상자 → 보이는 줄 (열마다 따로 읽힌 것 바로잡기)', () => {
  it('이름 열·금액 열이 따로 와도 같은 높이끼리 한 줄', () => {
    // 인식 서비스가 주는 순서: 이름들 먼저, 금액들 나중
    const boxes = [
      box('一蘭', 10, 0, 60),
      box('ラーメン', 10, 40, 80),
      box('替玉', 10, 80, 40),
      box('合計', 10, 120, 40),
      box('¥980', 300, 42, 50),
      box('¥210', 300, 79, 50),
      box('¥1,190', 290, 121, 60),
    ];
    expect(rowsFromBoxes(boxes)).toBe('一蘭\nラーメン ¥980\n替玉 ¥210\n合計 ¥1,190');
  });

  it('살짝 기울여 찍어도 (5도) 줄이 섞이지 않는다', () => {
    const a = (5 * Math.PI) / 180;
    // 금액은 같은 줄을 따라 오른쪽으로 280 — 기울기만큼 아래로 내려가 있다 (다음 줄보다 낮게)
    const boxes = [
      box('아메리카노', 10, 40, 100, 20, a),
      box('4,500', 10 + 280 * Math.cos(a), 40 + 280 * Math.sin(a), 60, 20, a),
      box('크로플', 10, 70, 60, 20, a),
      box('6,000', 10 + 280 * Math.cos(a), 70 + 280 * Math.sin(a), 60, 20, a),
    ];
    expect(rowsFromBoxes(boxes)).toBe('아메리카노 4,500\n크로플 6,000');
  });

  it('붙어 있는 한 글자씩(일본어·중국어)은 띄우지 않는다', () => {
    const boxes = [
      box('生', 10, 0, 20),
      box('ビ', 30, 0, 20),
      box('ー', 50, 0, 20),
      box('ル', 70, 0, 20),
    ];
    expect(rowsFromBoxes(boxes)).toBe('生ビール');
  });

  it('상자가 없으면 빈 글 (부르는 쪽이 전체 글로 대신)', () => {
    expect(rowsFromBoxes([])).toBe('');
    expect(rowsFromBoxes([{ text: 'x', poly: [] }])).toBe('');
  });

  it('Google 꼭짓점의 빠진 0, Azure의 두 모양', () => {
    expect(gPoly([{ y: 3 }, { x: 4 }])).toEqual([
      { x: 0, y: 3 },
      { x: 4, y: 0 },
    ]);
    expect(aPoly([1, 2, 3, 4])).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    expect(aPoly([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }]);
  });
});
