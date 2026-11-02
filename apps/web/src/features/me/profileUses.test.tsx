import { healthCardText } from '@trippocket/shared';
import { render, screen } from '@testing-library/react';
import { MySafetyInfo } from '../common/MySafetyInfo';
import { membershipFor, parseProfile, useTravelProfile } from '../../data/travelProfile';

/** 개인정보 새 항목이 쓰이는 곳 (사용자 요청 2026-11-02) */
afterEach(() => useTravelProfile.setState(parseProfile({})));

it('항공사 회원번호: 예약 항공사 이름이나 편명 앞 두 글자로 찾는다', () => {
  const list = [
    { airline: '대한항공', number: '111', tier: '모닝캄' },
    { airline: 'OZ', number: '222', tier: '' },
  ];
  expect(membershipFor(list, { provider: '대한항공', flightNo: 'KE703' })?.number).toBe('111');
  expect(membershipFor(list, { provider: 'Asiana Airlines', flightNo: 'OZ102' })?.number).toBe(
    '222',
  );
  expect(membershipFor(list, { provider: '진에어', flightNo: 'LJ201' })).toBeUndefined();
});

it('건강 카드: 고른 언어로 알레르기 문장, 언어가 없으면 영어', () => {
  const p = { allergens: ['peanut', 'shellfish'] as const, bloodType: 'O+' as const };
  const ja = healthCardText('ja', { ...p, allergens: [...p.allergens] });
  expect(ja.allergy).toContain('ピーナッツ、甲殻類');
  expect(ja.blood).toBe('血液型: O+');
  expect(healthCardText('xx', { allergens: ['egg'] }).allergy).toContain('I am allergic to: eggs');
  expect(healthCardText('en', { allergens: [] }).allergy).toBe('');
});

it('긴급 연락처의 "내 비상 정보": 보험·연락처는 누르면 전화, 적은 것이 없으면 안 보인다', () => {
  const { container, rerender } = render(<MySafetyInfo />);
  expect(container).toBeEmptyDOMElement();
  useTravelProfile.setState({
    insurance: { company: '여행보험', policyNo: 'P-1', phone: '+82-2-123-4567' },
    contacts: [{ name: '엄마', phone: '010-1111-2222' }],
    bloodType: 'A+',
  });
  rerender(<MySafetyInfo />);
  expect(screen.getByRole('link', { name: /여행보험/ })).toHaveAttribute(
    'href',
    expect.stringContaining('tel:'),
  );
  expect(screen.getByRole('link', { name: /엄마/ })).toBeInTheDocument();
  expect(screen.getByText('혈액형 A+')).toBeInTheDocument();
});
