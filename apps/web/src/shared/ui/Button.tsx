import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leading?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary active:bg-primary-pressed',
  secondary: 'bg-bg-subtle text-fg active:brightness-95',
  ghost: 'bg-transparent text-primary active:bg-primary-weak',
  danger: 'bg-danger text-on-primary active:brightness-95',
};

// 높이 52 / 44 / 36 (docs/11 §5)
const sizeClass: Record<Size, string> = {
  lg: 'h-13 px-5 text-body-1 font-semibold',
  md: 'h-11 px-4 text-body-2 font-semibold',
  sm: 'h-9 px-3 text-caption font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leading,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-1.5 rounded-btn transition-[filter,background-color] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variantClass[variant],
        sizeClass[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : leading}
      {children}
    </button>
  );
}
