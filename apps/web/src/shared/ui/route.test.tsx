import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DayLineTabs } from './DayLineTabs';
import { GateProgress } from './GateProgress';
import { NextStopCard } from './NextStopCard';
import { RouteBar } from './RouteBar';
import { routeColor } from './routeColor';
import { RouteLine } from './RouteLine';
import { RouteStop } from './RouteStop';
import { Stamp } from './Stamp';
import { TicketCard } from './TicketCard';
import { TransferChip } from './TransferChip';

/** 디자인 개편 "여행 노선" 공통 부품 (docs/29 §4) */
describe('routeColor', () => {
  it('8색 순환, 0부터', () => {
    expect(routeColor(0)).toEqual({ line: 'var(--tp-day-1)', ink: 'var(--tp-day-1-ink)' });
    expect(routeColor(8).line).toBe('var(--tp-day-1)');
    expect(routeColor(-1).line).toBe('var(--tp-day-8)');
  });
});

describe('RouteLine · RouteStop · TransferChip', () => {
  it('노선은 순서 목록, 다음 역은 aria-current=step, 누르면 onClick', async () => {
    const open = vi.fn();
    render(
      <RouteLine label="2일차 노선" dayIndex={1}>
        <RouteStop number={1} state="past" mark="visited" title="츠키지 장외시장" time="09:30" />
        <TransferChip aria-label="850m 길찾기">850m · 길찾기</TransferChip>
        <RouteStop
          number={2}
          state="next"
          title="센소지"
          meta="다음 · 38분 뒤"
          time="14:00"
          onClick={open}
          aria-label="센소지 14시"
        />
        <RouteStop title="기념품 메모" />
        <RouteStop number={3} title="스카이트리" last />
      </RouteLine>,
    );
    const list = screen.getByRole('list', { name: '2일차 노선' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    const next = within(list)
      .getAllByRole('listitem')
      .find((li) => li.getAttribute('aria-current') === 'step')!;
    expect(next).toHaveTextContent('센소지');
    await userEvent.click(screen.getByRole('button', { name: '센소지 14시' }));
    expect(open).toHaveBeenCalledOnce();
    // 시각이 없는 역은 —, 메모 줄은 빈칸
    expect(within(list).getAllByRole('listitem')[4]).toHaveTextContent('—');
  });
});

function DayHarness() {
  const [v, setV] = useState<'all' | 'd1' | 'd2'>('d1');
  return (
    <DayLineTabs
      label="일차"
      value={v}
      onChange={setV}
      items={[
        { value: 'all', label: '전체', dayIndex: null },
        { value: 'd1', label: '1일', sub: '11.24', dayIndex: 0 },
        { value: 'd2', label: '2일', sub: '11.25', dayIndex: 1, today: true },
      ]}
    />
  );
}

describe('DayLineTabs', () => {
  it('라디오 그룹으로 하나만 고른다', async () => {
    render(<DayHarness />);
    const group = screen.getByRole('radiogroup', { name: '일차' });
    expect(within(group).getByRole('radio', { name: /1일/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(within(group).getByRole('radio', { name: /2일/ }));
    expect(within(group).getByRole('radio', { name: /2일/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(group).getByRole('radio', { name: /1일/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});

describe('NextStopCard', () => {
  it('진행은 0~100으로 자르고, 진행이 없으면 막대가 없다', () => {
    const { rerender } = render(
      <NextStopCard
        label="다음 일정"
        kicker="다음 역"
        title="센소지"
        countdown="38분"
        progress={1.4}
        progressLabel="진행"
      />,
    );
    expect(screen.getByRole('region', { name: '다음 일정' })).toHaveTextContent('38분');
    expect(screen.getByRole('progressbar', { name: '진행' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    rerender(<NextStopCard label="다음 일정" kicker="다음 역" title="센소지" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('TicketCard', () => {
  it('탑승권: 코드·칸, 예약번호를 누르면 onClick / 안내표: 제목만', async () => {
    const copy = vi.fn();
    const { rerender } = render(
      <TicketCard
        header="KE703"
        from={{ code: 'ICN', sub: '09:05' }}
        to={{ code: 'NRT', sub: '11:30' }}
        cells={[
          {
            label: '예약번호',
            value: 'Q7XK2M',
            accent: true,
            onClick: copy,
            'aria-label': '예약번호 Q7XK2M 복사',
          },
          { label: '좌석', value: '32A' },
        ]}
      />,
    );
    expect(screen.getByText('ICN')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '예약번호 Q7XK2M 복사' }));
    expect(copy).toHaveBeenCalledOnce();
    rerender(
      <TicketCard
        title="호텔 그레이스리 신주쿠"
        cells={[{ label: '체크인', value: '11.24 15:00' }]}
      />,
    );
    expect(screen.queryByText('ICN')).toBeNull();
    expect(screen.getByText('호텔 그레이스리 신주쿠')).toBeInTheDocument();
  });
});

describe('GateProgress · RouteBar · Stamp', () => {
  it('진행 값과 이름', () => {
    render(
      <>
        <GateProgress
          title="출발 게이트"
          done={12}
          total={18}
          note="필수 2개 남았어요"
          tone="warn"
        />
        <RouteBar days={4} todayIndex={1} pastBefore={1} label="4일 중 2일차" />
        <Stamp city="Tokyo" period="2026.11" seed="t1" label="도쿄 2026년 11월" />
      </>,
    );
    expect(screen.getByRole('progressbar', { name: '출발 게이트' })).toHaveAttribute(
      'aria-valuenow',
      '12',
    );
    expect(screen.getByRole('img', { name: '4일 중 2일차' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '도쿄 2026년 11월' })).toHaveTextContent('TOKYO');
  });
});
