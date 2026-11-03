import { AIRLINE_PROGRAMS, airlineProgramFor, searchAirlines } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { AirlineInput, TierSelect } from './AirlineTierChips';

/** 항공사 회원 등급 (사용자 요청 2026-11-02, 2026-11-03 추천·드롭다운·항공사 추가) */
it('항공사 이름·코드·영문·예전 이름으로 회원 프로그램을 찾는다', () => {
  expect(airlineProgramFor('대한항공')?.code).toBe('KE');
  expect(airlineProgramFor('KE')?.code).toBe('KE');
  expect(airlineProgramFor('Asiana Airlines')?.code).toBe('OZ');
  expect(airlineProgramFor('티웨이항공')?.name).toBe('트리니티항공');
  expect(airlineProgramFor('플라이강원')?.name).toBe('파라타항공');
  expect(airlineProgramFor('Turkish Airlines')?.code).toBe('TK');
  // LCC는 등급 없음 (tiers = [])
  expect(airlineProgramFor('진에어')?.tiers).toEqual([]);
  expect(airlineProgramFor('피치')?.tiers).toEqual([]);
});

it('국내 항공사는 모두 들어 있고, 코드·이름이 겹치지 않는다', () => {
  const names = AIRLINE_PROGRAMS.map((p) => p.name);
  for (const n of [
    '대한항공',
    '아시아나항공',
    '제주항공',
    '진에어',
    '트리니티항공',
    '에어부산',
    '에어서울',
    '이스타항공',
    '에어로케이',
    '에어프레미아',
    '파라타항공',
    '하이에어',
    '섬에어',
  ])
    expect(names).toContain(n);
  expect(new Set(AIRLINE_PROGRAMS.map((p) => p.code)).size).toBe(AIRLINE_PROGRAMS.length);
  expect(new Set(names).size).toBe(names.length);
  expect(AIRLINE_PROGRAMS.length).toBeGreaterThanOrEqual(60);
});

it('추천: 이름 앞부분 먼저, 다 친 이름은 다시 추천하지 않는다', () => {
  expect(searchAirlines('에어').map((p) => p.name)[0]).toMatch(/^에어/);
  expect(searchAirlines('대한항공')).toEqual([]);
  expect(searchAirlines('')).toEqual([]);
});

function Harness() {
  const [airline, setAirline] = useState('');
  const [tier, setTier] = useState('');
  return (
    <>
      <AirlineInput value={airline} onChange={setAirline} />
      <TierSelect airline={airline} value={tier} onChange={setTier} />
      <output>{tier}</output>
    </>
  );
}

it('치면 입력창 오른쪽 추천을 눌러 채우고, 등급은 그 항공사 드롭다운', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByRole('textbox', { name: '항공사' }), '대한');
  await user.click(screen.getByRole('button', { name: '대한항공로 채우기' }));
  expect(screen.getByRole('textbox', { name: '항공사' })).toHaveValue('대한항공');
  await user.selectOptions(screen.getByRole('combobox', { name: 'SKYPASS 등급' }), '모닝캄');
  expect(screen.getByRole('status')).toHaveTextContent('모닝캄');
});

it('등급이 없는 항공사는 드롭다운에 "등급 없음"이 처음부터 보인다', () => {
  render(<TierSelect airline="제주항공" value="" onChange={() => {}} />);
  expect(screen.getByRole('combobox')).toHaveDisplayValue('등급 없음');
});
