import { airlineProgramFor } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AirlineTierChips } from './AirlineTierChips';

/** 항공사 회원 등급 칩 (사용자 요청 2026-11-02) */
it('항공사 이름·코드·영문으로 회원 프로그램을 찾는다', () => {
  expect(airlineProgramFor('대한항공')?.code).toBe('KE');
  expect(airlineProgramFor('KE')?.code).toBe('KE');
  expect(airlineProgramFor('Asiana Airlines')?.code).toBe('OZ');
  // LCC는 등급 없음 (tiers = [])
  expect(airlineProgramFor('진에어')?.tiers).toEqual([]);
});

it('항공사를 모르면 항공사 칩, 고르면 그 항공사 등급 칩', async () => {
  const onAirline = vi.fn();
  const onTier = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(
    <AirlineTierChips airline="" tier="" onAirline={onAirline} onTier={onTier} />,
  );
  await user.click(screen.getByRole('button', { name: '대한항공' }));
  expect(onAirline).toHaveBeenCalledWith('대한항공');
  rerender(<AirlineTierChips airline="대한항공" tier="" onAirline={onAirline} onTier={onTier} />);
  await user.click(screen.getByRole('button', { name: '모닝캄' }));
  expect(onTier).toHaveBeenCalledWith('모닝캄');
});

it('등급이 없는 항공사는 "등급 없음" 하나', async () => {
  const onTier = vi.fn();
  const user = userEvent.setup();
  render(<AirlineTierChips airline="제주항공" tier="" onAirline={() => {}} onTier={onTier} />);
  await user.click(screen.getByRole('button', { name: '등급 없음' }));
  expect(onTier).toHaveBeenCalledWith('등급 없음');
});
