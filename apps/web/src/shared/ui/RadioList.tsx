import * as RadioGroup from '@radix-ui/react-radio-group';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface RadioListOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface RadioListProps<T extends string> {
  /** 5개 이상이거나 설명이 필요한 선택지 (docs/12 §3.1) */
  options: ReadonlyArray<RadioListOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function RadioList<T extends string>({
  options,
  value,
  onChange,
  label,
}: RadioListProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onChange(v as T)}
      aria-label={label}
      className="flex flex-col divide-y divide-line"
    >
      {options.map((opt) => (
        <RadioGroup.Item
          key={opt.value}
          value={opt.value}
          disabled={opt.disabled ?? false}
          className="group flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-40"
        >
          {opt.icon && <span className="grid size-7 shrink-0 place-items-center">{opt.icon}</span>}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-2 font-medium">{opt.label}</span>
            {opt.description && (
              <span className="text-caption text-fg-muted">{opt.description}</span>
            )}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              'size-5 shrink-0 rounded-full border-2 border-line transition-[border-width,border-color]',
              'group-data-[state=checked]:border-[6px] group-data-[state=checked]:border-primary',
            )}
          />
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
