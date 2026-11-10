import { render, screen, within } from '@testing-library/react';
import { TripRouteView } from './TripRouteView';

it('여행 전체 노선도: 장소 있는 날만, 일차마다 역 순서대로', () => {
  render(
    <TripRouteView
      days={[
        { index: 0, date: '11.12 (목)', stops: ['나리타 공항', '신주쿠 호텔'] },
        { index: 1, date: '11.13 (금)', stops: [] },
        { index: 2, date: '11.14 (토)', stops: ['센소지'] },
      ]}
    />,
  );
  expect(screen.queryByText('11.13 (금)')).toBeNull();
  const day1 = screen.getByRole('list', { name: '1일차' });
  expect(
    within(day1)
      .getAllByRole('listitem')
      .map((li) => li.textContent),
  ).toEqual(['1나리타 공항', '2신주쿠 호텔']);
  expect(screen.getByRole('list', { name: '3일차' })).toHaveTextContent('센소지');
});

it('장소 있는 날이 없으면 안내', () => {
  render(<TripRouteView days={[{ index: 0, date: '11.12 (목)', stops: [] }]} />);
  expect(screen.getByText('아직 장소가 있는 날이 없어요')).toBeInTheDocument();
});
