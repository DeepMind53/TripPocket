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
  expect(cells[0]).toHaveTextContent('🇯🇵 일본3번');
  expect(cells[1]).toHaveTextContent('🇹🇼 대만2번');
  await user.click(screen.getByRole('button', { name: '+ 더보기 (2개 나라)' }));
  expect(within(list).getAllByRole('listitem')).toHaveLength(11);
});
