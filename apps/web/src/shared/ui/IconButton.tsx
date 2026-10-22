import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label'
> {
  /** 스크린리더용 이름 (필수) */
  label: string;
  icon: ReactNode;
  tone?: 'plain' | 'tint';
}

/** 아이콘만 있는 버튼. 터치 영역 44×44 (docs/11 §5) */
export function IconButton({
  label,
  icon,
  tone = 'plain',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid size-11 place-items-center rounded-btn transition-colors',
        tone === 'plain' && 'text-fg-sub active:bg-bg-subtle',
        tone === 'tint' && 'bg-primary-weak text-primary active:brightness-95',
        'disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="[&>svg]:size-5">
        {icon}
      </span>
    </button>
  );
}
