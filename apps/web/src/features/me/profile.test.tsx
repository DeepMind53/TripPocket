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
  // 직접 추가: 비선호 음식 (한글·영어)
  await user.click(screen.getByRole('radio', { name: '비선호' }));
  await user.type(screen.getByLabelText('한글 (예: 고수)'), '고수');
  await user.type(screen.getByLabelText('영어 (예: coriander)'), 'coriander');
  await user.click(screen.getByRole('button', { name: '음식 추가' }));
  await user.click(screen.getByRole('button', { name: '땅콩' }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('tp-travel-profile')!)).toMatchObject({
      passportExpiry: '2030-05-01',
      seat: 'window',
      customFoods: [{ ko: '고수', en: 'coriander', kind: 'dislike' }],
      allergens: ['peanut'],
    }),
  );
});

it('예전 "그 밖에 못 먹는 음식" 글은 비선호 음식 한 줄로 옮긴다 (2026-11-02)', () => {
  expect(parseProfile({ food: '고수, 날음식' }).customFoods).toEqual([
    { ko: '고수, 날음식', en: '', kind: 'dislike' },
  ]);
});

it('예전 여권 만료일은 개인정보로 옮겨 읽고, 틀린 값은 버린다', () => {
  expect(parseProfile({ passportExpiry: '2030-1-1', seat: 'roof', food: 3 })).toEqual({
    passportExpiry: null,
    licenseExpiry: null,
    seat: 'any',
    memo: '',
    permits: {},
    memberships: [],
    insurance: { company: '', policyNo: '', phone: '' },
    contacts: [],
    allergens: [],
    customFoods: [],
    bloodType: null,
    meds: '',
  });
});
