import { PHRASE_LANGS } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseProfile, useTravelProfile } from '../../data/travelProfile';
import { HealthCardButton } from './HealthCardButton';

/** 건강 카드는 알레르기·혈액형·복용약을 따로, 영어를 함께 (사용자 요청 2026-11-02) */
afterEach(() => useTravelProfile.setState(parseProfile({})));
const ja = PHRASE_LANGS.find((l) => l.code === 'ja')!;
const en = PHRASE_LANGS.find((l) => l.code === 'en')!;

it('카드가 따로 있고, 일본어 카드에 영어가 함께 보인다', async () => {
  useTravelProfile.setState({ allergens: ['peanut'], bloodType: 'O+', meds: '혈압약' });
  const user = userEvent.setup();
  render(<HealthCardButton lang={ja} />);
  expect(screen.getAllByRole('button')).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: /혈액형 카드/ }));
  const card = screen.getByRole('dialog');
  expect(card).toHaveTextContent('血液型: O+');
  expect(card).toHaveTextContent('Blood type: O+');
  expect(card).not.toHaveTextContent('ピーナッツ');
});

it('영어를 고르면 영어를 두 번 쓰지 않는다', async () => {
  useTravelProfile.setState({ allergens: ['egg'] });
  const user = userEvent.setup();
  render(<HealthCardButton lang={en} />);
  await user.click(screen.getByRole('button', { name: /알레르기 카드/ }));
  expect(screen.getAllByText(/I am allergic to: eggs/)).toHaveLength(1);
});
