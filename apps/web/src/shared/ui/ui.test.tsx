import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button } from './Button';
import { Chip } from './Chip';
import { SegmentedControl } from './SegmentedControl';
import { Stepper } from './Stepper';
import { Switch } from './Switch';
import { Toaster } from './Toaster';
import { snackbar, toast, useToastStore } from './toastStore';

describe('Button', () => {
  it('로딩 중에는 누를 수 없고 aria-busy를 표시한다', () => {
    render(<Button loading>저장</Button>);
    const btn = screen.getByRole('button', { name: /저장/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Chip', () => {
  it('selected를 aria-pressed로 알린다', () => {
    render(<Chip selected>맛집</Chip>);
    expect(screen.getByRole('button', { name: '맛집' })).toHaveAttribute('aria-pressed', 'true');
  });
});

function StepperHarness({ initial = 14 }: { initial?: number }) {
  const [v, setV] = useState(initial);
  return (
    <Stepper
      label="백업 알림 주기"
      value={v}
      onChange={setV}
      min={0}
      max={56}
      step={7}
      format={(n) => (n === 0 ? '끄기' : `${n}일`)}
    />
  );
}

describe('Stepper', () => {
  it('간격만큼 바뀌고 범위 끝에서 버튼이 비활성화된다', async () => {
    const user = userEvent.setup();
    render(<StepperHarness initial={7} />);
    const minus = screen.getByRole('button', { name: '백업 알림 주기 줄이기' });
    const plus = screen.getByRole('button', { name: '백업 알림 주기 늘리기' });

    await user.click(minus);
    expect(screen.getByText('끄기')).toBeInTheDocument();
    expect(minus).toBeDisabled();

    await user.click(plus);
    await user.click(plus);
    expect(screen.getByText('14일')).toBeInTheDocument();
  });

  it('최댓값에서는 늘리기 버튼이 비활성화된다', () => {
    render(<StepperHarness initial={56} />);
    expect(screen.getByRole('button', { name: '백업 알림 주기 늘리기' })).toBeDisabled();
  });
});

function SegmentHarness() {
  const [v, setV] = useState<'light' | 'dark' | 'system'>('system');
  return (
    <SegmentedControl
      label="테마"
      value={v}
      onChange={setV}
      options={[
        { value: 'light', label: '라이트' },
        { value: 'dark', label: '다크' },
        { value: 'system', label: '시스템' },
      ]}
    />
  );
}

describe('SegmentedControl', () => {
  it('라디오 그룹으로 동작하고 하나만 선택된다', async () => {
    const user = userEvent.setup();
    render(<SegmentHarness />);
    expect(screen.getByRole('radiogroup', { name: '테마' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '시스템' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: '다크' }));
    expect(screen.getByRole('radio', { name: '다크' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '시스템' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Switch', () => {
  it('누르면 켜짐/꺼짐이 바뀐다', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch label="진동" checked={on} onCheckedChange={setOn} />;
    }
    render(<Harness />);
    const sw = screen.getByRole('switch', { name: '진동' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

describe('toast / snackbar', () => {
  beforeEach(() => {
    useToastStore.setState({ items: [] });
  });

  it('토스트는 2초 뒤 사라진다', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast('복사했어요');
    });
    expect(screen.getByText('복사했어요')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.queryByText('복사했어요')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('스낵바의 실행 취소를 누르면 콜백이 불리고 닫힌다', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<Toaster />);
    act(() => {
      snackbar('삭제했어요', { label: '실행 취소', onAction: onUndo });
    });
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.queryByText('삭제했어요')).not.toBeInTheDocument();
  });

  it('최대 3개까지만 쌓인다', () => {
    for (let i = 1; i <= 5; i++) toast(`알림 ${i}`);
    expect(useToastStore.getState().items.map((t) => t.message)).toEqual([
      '알림 3',
      '알림 4',
      '알림 5',
    ]);
  });
});
