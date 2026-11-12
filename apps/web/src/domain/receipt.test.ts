import { parseReceipt, photoTarget } from './receipt';

describe('영수증 글 → 품목·금액 (볼 때 계산)', () => {
  it('일본 영수증: 품목·엔, 합계는 따로, 세금·거스름돈·날짜는 뺀다', () => {
    const text = [
      '一蘭 新宿店',
      '2026/11/11 12:30',
      'ラーメン ¥980',
      '替玉 210円',
      '生ビール 600',
      '小計 1,790',
      '消費税 179',
      '合計 ¥1,969',
      'お預り 2,000',
      'お釣り 31',
    ].join('\n');
    expect(parseReceipt(text)).toEqual({
      lines: [
        { name: 'ラーメン', price: 980 },
        { name: '替玉', price: 210 },
        { name: '生ビール', price: 600 },
      ],
      total: 1969,
    });
  });

  it('한국 영수증: 원·쉼표, 부가세·카드 줄은 품목이 아니다', () => {
    const text = '아메리카노 4,500원\n크로플 6,000\n부가세 955\n합계 10,500\n카드 10,500';
    expect(parseReceipt(text)).toEqual({
      lines: [
        { name: '아메리카노', price: 4500 },
        { name: '크로플', price: 6000 },
      ],
      total: 10500,
    });
  });

  it('달러 소수점, 숫자만 있는 줄은 무시', () => {
    expect(parseReceipt('Coffee $3.50\n12345\nTOTAL $3.50')).toEqual({
      lines: [{ name: 'Coffee', price: 3.5 }],
      total: 3.5,
    });
  });
});

describe('영수증 — 실제로 잘 안 읽히던 모양 (2026-11-12)', () => {
  it('이름 열과 금액 열이 따로 읽혀도 순서대로 짝짓는다 (가게 이름 같은 머리 줄은 빼고)', () => {
    const text = ['一蘭 新宿店', 'ラーメン', '替玉', '合計', '¥980', '¥210', '¥1,190'].join('\n');
    expect(parseReceipt(text)).toEqual({
      lines: [
        { name: 'ラーメン', price: 980 },
        { name: '替玉', price: 210 },
      ],
      total: 1190,
    });
  });

  it('단가·수량·금액 칸과 품목 번호는 이름에서 뺀다', () => {
    const text =
      '상품명 단가 수량 금액\n001 아메리카노 4,500 2 9,000\n크로플 x1 6,000\n합계 15,000';
    expect(parseReceipt(text)).toEqual({
      lines: [
        { name: '아메리카노', price: 9000 },
        { name: '크로플', price: 6000 },
      ],
      total: 15000,
    });
  });

  it('일본 영수증 표시: 경감세율 軽·뒤 대시·전각 숫자·할인 △', () => {
    const text = 'おにぎり ¥150軽\n緑茶 １２０円※\n弁当 ¥580-\n値引 △50\n合計 ¥800';
    expect(parseReceipt(text)).toEqual({
      lines: [
        { name: 'おにぎり', price: 150 },
        { name: '緑茶', price: 120 },
        { name: '弁当', price: 580 },
        { name: '値引', price: -50 },
      ],
      total: 800,
    });
  });

  it('유럽 소수 쉼표·천 단위 점, 미국 과세 표시 T', () => {
    expect(parseReceipt('Croissant 2,50 €\nMenu 1.234,50\nTOTAL 1.237,00').lines).toEqual([
      { name: 'Croissant', price: 2.5 },
      { name: 'Menu', price: 1234.5 },
    ]);
    expect(parseReceipt('Bagel 4.99 T\nTax 0.40\nTotal 5.39')).toEqual({
      lines: [{ name: 'Bagel', price: 4.99 }],
      total: 5.39,
    });
  });
});

describe('찍은 사진을 붙일 일정', () => {
  const items = [
    { id: 'a', kind: 'place' as const, startTime: '09:00', endTime: '10:00' },
    { id: 'n', kind: 'note' as const, startTime: '10:30' },
    { id: 'b', kind: 'food' as const, startTime: '12:00', endTime: '13:00' },
    { id: 'c', kind: 'cafe' as const, startTime: '15:00' },
  ];
  it('진행 중 → 바로 앞 → 다음 순, 메모는 빼고', () => {
    expect(photoTarget(items, '12:30')).toBe('b');
    expect(photoTarget(items, '13:30')).toBe('b');
    expect(photoTarget(items, '10:40')).toBe('a');
    expect(photoTarget(items, '08:00')).toBe('a');
    expect(photoTarget([], '12:00')).toBeNull();
  });
});
