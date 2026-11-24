import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

/**
 * 색 규칙 (사용자 요청 2026-11-03, 취소는 2026-11-23 빨강 → 회색): 확인·저장·추가·시작 = primary(파랑), 취소 = cancel(회색 — 빨강은 삭제에만),
 * 나중에·괜찮아요·닫기 같은 넘어가기 = secondary/ghost. danger는 화면 안의 위험 동작(여행 삭제 등)
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft' | 'cancel';
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
  // 회색 바탕 + 빨간 글자: 시트 아래 [삭제]처럼 덜 눈에 띄어야 하는 지우기 (docs/31 A2 — className으로 글자색만 바꾸면 text-fg가 이긴다)
  dangerSoft: 'bg-bg-subtle text-danger active:brightness-95',
  cancel: 'bg-bg-subtle text-fg active:brightness-95',
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
        // 꺼진 버튼: 흐리게만 하면 바탕과 섞여 버튼인지 모른다 → 회색 바탕 + 회색 글자, 대비 3:1 이상 (docs/31 C2)
        'disabled:cursor-not-allowed disabled:text-fg-muted',
        variant !== 'ghost' && 'disabled:bg-bg-subtle',
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
