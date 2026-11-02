import type { Booking } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlightAirportInfo } from './FlightAirportInfo';

/** 항공 예약 카드의 공항 정보 (사용자 요청 2026-11-02) */
const flight = (o: Partial<Booking>) =>
  ({
    id: 'b1',
    tripId: 't',
    kind: 'flight',
    title: 'KE703',
    start: { date: '2026-11-03', place: 'ICN' },
    end: { date: '2026-11-03', place: 'NRT' },
    details: { flightNo: 'KE703' },
    ...o,
  }) as Booking;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem('tp-flight-airport');
});

it('인천 출발편: 터미널·체크인 카운터·게이트와 확인 시각, 전날 다시 확인 안내', async () => {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    return Response.json({
      checkedAt: '2026-11-02T10:00:00.000Z',
      dep: { info: { airport: 'ICN', terminal: 'T2', counter: 'A B C D', gate: '267' } },
      arr: null,
    });
  });
  const user = userEvent.setup();
  render(<FlightAirportInfo booking={flight({})} />);
  await user.click(screen.getByRole('button', { name: '확인하기' }));
  expect(await screen.findByText(/T2 · 체크인 A B C D · 게이트 267/)).toBeInTheDocument();
  expect(screen.getByText(/출발 전날과 당일에 다시 확인하세요/)).toBeInTheDocument();
  // 해외 도착 공항은 묻지 않는다
  expect(urls[0]).toBe('/api/flights/KE703/airport?date=2026-11-03&from=ICN&arrDate=2026-11-03');
});

it('국내 공항이 없거나 편명이 없으면 보이지 않는다', () => {
  const { container, rerender } = render(
    <FlightAirportInfo
      booking={flight({
        start: { date: '2026-11-03', place: 'NRT' },
        end: { date: '2026-11-03', place: 'HND' },
      })}
    />,
  );
  expect(container).toBeEmptyDOMElement();
  rerender(<FlightAirportInfo booking={flight({ details: {} })} />);
  expect(container).toBeEmptyDOMElement();
});
