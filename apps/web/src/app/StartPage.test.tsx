import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';

describe('StartPage', () => {
  it('앱 이름, 공용 패키지 계산 결과, 미리보기 링크를 보여준다', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('heading', { name: '트립포켓' })).toBeInTheDocument();
    expect(screen.getByText('4박 5일')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '컴포넌트 미리보기' })).toHaveAttribute(
      'href',
      '/dev/ui',
    );
  });
});
