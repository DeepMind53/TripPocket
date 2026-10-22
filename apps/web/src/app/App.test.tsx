import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('앱 이름과 공용 패키지 계산 결과를 보여준다', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '트립포켓' })).toBeInTheDocument();
    expect(screen.getByText('4박 5일')).toBeInTheDocument();
  });
});
