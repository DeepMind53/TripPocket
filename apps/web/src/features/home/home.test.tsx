import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb, seedSampleTrip } from '../../data/dev';
import { checklistRepo } from '../../data/repositories/checklistRepo';

beforeEach(async () => {
  await resetLocalDb();
});

it('여행 전 홈: 준비 현황 4장(준비물·예약·첫날 날씨·환율) + AI 추천, 숙소 없으면 확인 표시', async () => {
  const tripId = await seedSampleTrip(); // 3일 뒤 출발
  await checklistRepo.add(tripId, 'packing', { text: '여권' });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
  const prep = await screen.findByRole('region', { name: '준비 현황' });
  // 기본은 한 줄 요약 (docs/20 U3) — 누르면 펼침
  const summary = within(prep).getByRole('button', { expanded: false });
  await waitFor(() => expect(summary).toHaveTextContent('🧳 0/1'));
  fireEvent.click(summary);
  for (const name of ['준비물', '예약', '첫날 날씨', '환율'])
    expect(within(prep).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
  expect(within(prep).getByRole('link', { name: /예약/ })).toHaveAttribute(
    'href',
    `/trips/${tripId}/bookings`,
  );
  expect(within(prep).getByText('숙소 예약이 없어요')).toBeInTheDocument();
  expect(within(prep).getAllByRole('img', { name: '확인이 필요해요' }).length).toBeGreaterThan(0);
  expect(within(prep).getByRole('link', { name: /AI 추천 받기/ })).toHaveAttribute(
    'href',
    `/ai?trip=${tripId}`,
  );
});
