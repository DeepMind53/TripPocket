import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type Ref } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../lib/cn';

export interface ScrollRowProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  /** 바깥 상자(위치·고정)용 클래스 — 기본 className은 안쪽 가로 줄에 붙는다 */
  outerClassName?: string;
}

/**
 * 가로로 미는 줄 (칩 줄 등, 사용자 요청 2026-10-25): 스크롤바는 숨기고,
 * 오른쪽에 더 있으면 위쪽 끝에 반투명 "밀어서 더 보기" — 미는 동안은 숨고 멈추면 다시 나온다
 */
export function ScrollRow({ ref, className, outerClassName, children, ...rest }: ScrollRowProps) {
  const { t } = useTranslation();
  const inner = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  const [moving, setMoving] = useState(false);
  const idle = useRef<number | undefined>(undefined);

  const measure = useCallback(() => {
    const el = inner.current;
    if (el) setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    for (const c of el.children) ro?.observe(c);
    return () => {
      ro?.disconnect();
      window.clearTimeout(idle.current);
    };
  }, [measure, children]);

  const setRefs = (el: HTMLDivElement | null) => {
    inner.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  return (
    <div className={cn('relative', outerClassName)}>
      <div
        ref={setRefs}
        {...rest}
        onScroll={(e) => {
          rest.onScroll?.(e);
          measure();
          setMoving(true);
          window.clearTimeout(idle.current);
          idle.current = window.setTimeout(() => setMoving(false), 700);
        }}
        className={cn(
          'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className,
        )}
      >
        {children}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-0.5 right-1 flex items-center gap-0.5 rounded-full bg-fg/55 py-0.5 pr-1 pl-2 text-micro text-bg backdrop-blur-sm transition-opacity duration-200',
          more && !moving ? 'opacity-100' : 'opacity-0',
        )}
      >
        {t('common.swipeMore')}
        <ChevronRight className="size-3" />
      </span>
    </div>
  );
}
