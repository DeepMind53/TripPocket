import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { resetLocalDb } from '../../data/dev';
import { setPassportExpiry } from '../../data/passportExpiry';
import { checklistRepo } from '../../data/repositories/checklistRepo';
import { tripRepo } from '../../data/repositories/tripRepo';

let tripId = '';
beforeEach(async () => {
  await resetLocalDb();
  setPassportExpiry(null);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T03:00:00Z'));
  tripId = (
    await tripRepo.create({
      title: '방콕',
      destinations: [{ name: '방콕', kind: 'city', countryCode: 'TH' }],
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      timezone: 'Asia/Bangkok',
      cover: {},
    })
  ).id;
});
afterEach(() => vi.useRealTimers());

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

it('필수 항목: 태국 TDAC·비자(자동)·공식 링크, 체크하면 저장, 여권 만료일로 자동 판단', async () => {
  const user = userEvent.setup();
  renderAt(`/trips/${tripId}/essentials`);
  const th = await screen.findByRole('region', { name: '태국' });
  expect(within(th).getByRole('checkbox', { name: '비자' })).toBeChecked();
  expect(within(th).getByRole('checkbox', { name: '비자' })).toBeDisabled(); // 자동
  const tdac = within(th).getByRole('checkbox', { name: '디지털 입국카드 (TDAC)' });
  expect(within(th).getByText('지금 할 수 있어요')).toBeInTheDocument();
  expect(within(th).getAllByRole('link', { name: /공식 사이트 열기/ })[0]).toHaveAttribute(
    'href',
    'https://tdac.immigration.go.th/',
  );
  await user.click(tdac);
  await waitFor(async () =>
    expect(
      (await checklistRepo.list(tripId, 'essentials')).map((i) => [i.text, i.checked]),
    ).toEqual([['TH:arrival', true]]),
  );
  expect(tdac).toBeChecked();

  // 여권: 귀국일 + 6개월보다 짧으면 경고
  await user.click(within(th).getByRole('button', { name: /여권 만료일 넣고/ }));
  await user.type(within(th).getByLabelText('여권 만료일'), '2027-01-01');
  expect(await within(th).findByText(/2027-05-04까지는 남아야/)).toBeInTheDocument();
});

it('홈 준비 현황에 필수 항목 칸 (완료 수·다음 할 일)', async () => {
  renderAt('/');
  const prep = await screen.findByRole('region', { name: '준비 현황' });
  await waitFor(() =>
    expect(within(prep).getByRole('button', { expanded: false })).toHaveTextContent(/🛂 \d+\/\d+/),
  );
  fireEvent.click(within(prep).getByRole('button', { expanded: false }));
  expect(await screen.findByRole('link', { name: /필수 항목 체크리스트/ })).toHaveTextContent(
    '다음: 디지털 입국카드 (TDAC)',
  );
});
