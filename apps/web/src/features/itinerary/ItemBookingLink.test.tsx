import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetLocalDb } from '../../data/dev';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { itemRepo } from '../../data/repositories/itemRepo';
import { tripRepo } from '../../data/repositories/tripRepo';
import { ItemBookingLink } from './ItemBookingLink';

beforeEach(resetLocalDb);

it('일정 상세 [예약 연결]: 티켓을 고르면 연결, [연결 안 함]이면 끊는다 (2026-11-26)', async () => {
  const trip = await tripRepo.create({
    title: '도쿄',
    destinations: [],
    startDate: '2026-10-24',
    endDate: '2026-10-26',
    timezone: 'Asia/Tokyo',
    cover: {},
  });
  const item = await itemRepo.create({
    tripId: trip.id,
    date: '2026-10-25',
    kind: 'place',
    title: '센소지',
  });
  const ticket = await bookingRepo.create({
    tripId: trip.id,
    kind: 'ticket',
    title: '입장권',
    start: { date: '2026-10-25' },
  });
  await bookingRepo.create({
    tripId: trip.id,
    kind: 'flight',
    title: 'KE701',
    start: { date: '2026-10-24' },
  });
  const user = userEvent.setup();
  const { rerender } = render(<ItemBookingLink item={item} linkedId={undefined} />);
  const select = await screen.findByLabelText('예약 연결');
  // 투어·티켓만 보인다
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
  await user.selectOptions(select, ticket.id);
  await waitFor(async () => expect((await itemRepo.get(item.id))?.bookingId).toBe(ticket.id));
  rerender(<ItemBookingLink item={item} linkedId={ticket.id} />);
  await user.selectOptions(screen.getByLabelText('예약 연결'), '');
  await waitFor(async () => expect((await itemRepo.get(item.id))?.bookingId).toBeUndefined());
  expect((await bookingRepo.get(ticket.id))?.attachedItemId).toBeUndefined();
});
