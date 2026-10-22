import * as RadioGroup from '@radix-ui/react-radio-group';
import { cn } from '../lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  /** 2~4개 권장 (docs/12 §3.1) */
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/** 짧은 선택지 2~4개 중 하나. 화살표 키로도 이동 가능 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onChange(v as T)}
      orientation="horizontal"
      aria-label={label}
      className={cn(
        'grid auto-cols-fr grid-flow-col gap-[3px] rounded-[10px] bg-bg-subtle p-[3px]',
        className,
      )}
    >
      {options.map((opt) => (
        <RadioGroup.Item
          key={opt.value}
          value={opt.value}
          className={cn(
            'h-9 rounded-lg px-2 text-caption text-fg-sub transition-colors',
            'data-[state=checked]:bg-surface data-[state=checked]:font-bold data-[state=checked]:text-fg data-[state=checked]:shadow-card',
          )}
        >
          {opt.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
