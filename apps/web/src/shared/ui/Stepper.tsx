import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '../lib/cn';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** 화면 표시 형식 (예: 0 → "끄기", 14 → "14일") */
  format?: (value: number) => string;
  label: string;
}

const HOLD_DELAY = 400;
const HOLD_INTERVAL = 100;

/** 정해진 간격의 작은 숫자 (docs/12 §3.1). 버튼을 길게 누르면 연속으로 바뀐다. */
export function Stepper({ value, onChange, min, max, step = 1, format, label }: StepperProps) {
  // 길게 누르는 동안 최신 값을 써야 하므로 ref로 보관
  const valueRef = useRef(value);
  const timers = useRef<{ delay?: number; repeat?: number }>({});
  // 길게 눌러 연속 변경이 일어났으면, 손을 뗄 때 오는 click은 무시한다
  const held = useRef(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => stopHold, []);

  function apply(direction: 1 | -1): boolean {
    const next = Math.min(max, Math.max(min, valueRef.current + direction * step));
    if (next === valueRef.current) return false;
    valueRef.current = next;
    onChange(next);
    return true;
  }

  function startHold(direction: 1 | -1) {
    stopHold();
    held.current = false;
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => {
        held.current = true;
        if (!apply(direction)) stopHold();
      }, HOLD_INTERVAL);
    }, HOLD_DELAY);
  }

  function handleClick(direction: 1 | -1) {
    if (held.current) {
      held.current = false;
      return;
    }
    apply(direction);
  }

  function stopHold() {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.repeat);
    timers.current = {};
  }

  const display = format ? format(value) : String(value);
  const buttonClass = cn(
    'grid size-11 place-items-center rounded-btn border border-line bg-surface text-fg',
    'active:bg-bg-subtle disabled:opacity-35',
  );

  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`${label} 줄이기`}
        className={buttonClass}
        disabled={value <= min}
        onClick={() => handleClick(-1)}
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <output aria-live="polite" className="tabular min-w-14 text-center text-body-1 font-bold">
        {display}
      </output>
      <button
        type="button"
        aria-label={`${label} 늘리기`}
        className={buttonClass}
        disabled={value >= max}
        onClick={() => handleClick(1)}
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
