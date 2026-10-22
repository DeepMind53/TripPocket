import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '../lib/cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** <label htmlFor={id}>로 연결할 때 */
  id?: string;
  /** 보이는 라벨이 없을 때 스크린리더용 이름 */
  label?: string;
  disabled?: boolean;
}

/** 켜기/끄기. 51×31 비율 (docs/12 §4) */
export function Switch({ checked, onCheckedChange, id, label, disabled = false }: SwitchProps) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      {...(id ? { id } : {})}
      {...(label ? { 'aria-label': label } : {})}
      className={cn(
        'relative h-[31px] w-[51px] shrink-0 rounded-full bg-line transition-colors',
        'data-[state=checked]:bg-primary disabled:opacity-40',
      )}
    >
      <RadixSwitch.Thumb className="block size-[27px] translate-x-[2px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200 data-[state=checked]:translate-x-[22px]" />
    </RadixSwitch.Root>
  );
}
