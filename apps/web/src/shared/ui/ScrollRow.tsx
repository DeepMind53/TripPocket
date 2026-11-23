import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type Ref } from 'react';
import { cn } from '../lib/cn';

export interface ScrollRowProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  /** 바깥 상자(위치·고정)용 클래스 — 기본 className은 안쪽 가로 줄에 붙는다 */
  outerClassName?: string;
}

/**
 * 가로로 미는 줄 (칩 줄 등, 사용자 요청 2026-10-25): 스크롤바는 숨기고,
 * 오른쪽에 더 있으면 오른쪽 끝을 흐리게 지운다 — 반쯤 보이는 칩이 "더 있다"를 알려 준다.
 * (2026-11-14의 › 동그라미는 마지막 칩 테두리를 덮어 2026-11-23 뺐다, 사용자 결정)
 */
export function ScrollRow({ ref, className, outerClassName, children, ...rest }: ScrollRowProps) {
  const inner = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);

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
    return () => ro?.disconnect();
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
        }}
        className={cn(
          // relative: 안의 sr-only(절대 위치) 글자가 이 줄 기준으로 잘리게. 없으면 바깥 상자 기준이 되어
          // 화면 밖으로 삐져나가 페이지 폭을 넓히고, 휴대폰이 화면을 축소해 오른쪽·아래가 비었다 (2026-11-17)
          'relative overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          // 배경색과 상관없이 끝만 흐리게 (시트·카드 안에서도)
          more && '[mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
