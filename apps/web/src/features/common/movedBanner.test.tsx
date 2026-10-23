import { render, screen } from '@testing-library/react';
import { MovedBanner } from './MovedBanner';

describe('옛 주소 안내', () => {
  it('pages.dev 에서만 새 주소·백업 안내', () => {
    const { rerender } = render(<MovedBanner host="trippocket.pages.dev" />);
    expect(screen.getByRole('link', { name: '새 주소로 열기' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/trippocket\.day\//),
    );
    expect(screen.getByRole('link', { name: '먼저 백업하기' })).toHaveAttribute('href', '/backup');
    rerender(<MovedBanner host="trippocket.day" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
