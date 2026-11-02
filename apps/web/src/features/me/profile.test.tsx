import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../../app/router';
import { parseProfile, useTravelProfile } from '../../data/travelProfile';

afterEach(() => {
  localStorage.removeItem('tp-travel-profile');
  useTravelProfile.setState(parseProfile({}));
});

it('마이 → 개인정보: 고치면 바로 이 기기에 저장 (2026-10-27)', async () => {
  const user = userEvent.setup();
  render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/me/profile'] })} />,
  );
  fireEvent.change(await screen.findByLabelText(/^여권 만료일/), {
    target: { value: '2030-05-01' },
  });
  await user.click(screen.getByRole('radio', { name: '창가' }));
  await user.type(screen.getByLabelText('그 밖에 못 먹는 음식'), '고수');
  await user.click(screen.getByRole('button', { name: '땅콩' }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('tp-travel-profile')!)).toMatchObject({
      passportExpiry: '2030-05-01',
      seat: 'window',
      food: '고수',
      allergens: ['peanut'],
    }),
  );
});

it('예전 여권 만료일은 개인정보로 옮겨 읽고, 틀린 값은 버린다', () => {
  expect(parseProfile({ passportExpiry: '2030-1-1', seat: 'roof', food: 3 })).toEqual({
    passportExpiry: null,
    licenseExpiry: null,
    seat: 'any',
    food: '',
    memo: '',
    permits: {},
    memberships: [],
    insurance: { company: '', policyNo: '', phone: '' },
    contacts: [],
    allergens: [],
    bloodType: null,
    meds: '',
  });
});
