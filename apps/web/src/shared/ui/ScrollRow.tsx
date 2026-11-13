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
 * 오른쪽에 더 있으면 오른쪽 끝을 흐리게 지우고 작은 › 표시 (2026-11-14 다듬기 — 전에는 칩을 덮는 검은 말풍선).
 * 미는 동안은 › 가 숨고 멈추면 다시 나온다. "밀어서 더 보기"는 화면 읽기용 글자로만
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
          // 배경색과 상관없이 끝만 흐리게 (시트·카드 안에서도)
          more && '[mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)]',
          className,
        )}
      >
        {children}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 flex items-center text-fg-muted transition-opacity duration-200',
          more && !moving ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span className="sr-only">{t('common.swipeMore')}</span>
        <span className="grid size-6 place-items-center rounded-full border border-line bg-surface">
          <ChevronRight className="size-4" />
        </span>
      </span>
    </div>
  );
}
