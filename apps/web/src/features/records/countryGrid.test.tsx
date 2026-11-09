import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CountryGrid } from './CountryGrid';

it('가 본 나라: 많이 간 나라 먼저 "국기 이름", 9개 넘으면 더보기', async () => {
  const codes = ['TW', 'JP', 'TH', 'VN', 'PH', 'US', 'FR', 'IT', 'ES', 'DE', 'GB'];
  const counts = new Map(codes.map((c) => [c, c === 'JP' ? 3 : c === 'TW' ? 2 : 1]));
  const user = userEvent.setup();
  render(<CountryGrid codes={codes} counts={counts} />);
  const list = screen.getByRole('list', { name: '가 본 나라' });
  const cells = within(list).getAllByRole('listitem');
  expect(cells).toHaveLength(9);
  // 여권 도장 모양 (docs/29 §7.21, 2026-11-10): 도장 안 나라 이름·횟수, 도장 아래 국기 — 같은 정보
  expect(within(cells[0]!).getByRole('img', { name: '일본 3번' })).toBeInTheDocument();
  expect(cells[0]).toHaveTextContent('🇯🇵');
  expect(within(cells[1]!).getByRole('img', { name: '대만 2번' })).toBeInTheDocument();
  expect(cells[1]).toHaveTextContent('🇹🇼');
  await user.click(screen.getByRole('button', { name: '+ 더보기 (2개 나라)' }));
  expect(within(list).getAllByRole('listitem')).toHaveLength(11);
});
