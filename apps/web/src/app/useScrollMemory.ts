import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/** 화면(주소)별 마지막 스크롤 위치 — 이번 실행 동안만 (메모리) */
const positions = new Map<string, number>();

/**
 * 탭을 오가거나 뒤로 가도 보던 위치로 (docs/20 U6).
 * 화면 내용(기기 DB)이 조금 늦게 그려지므로, 그 높이가 될 때까지 짧게 여러 번 시도한다.
 * 같은 주소에서 시트만 여닫는 이동(location.state만 바뀜)은 건드리지 않는다
 */
export function useScrollMemory(): void {
  const { pathname } = useLocation();
  const type = useNavigationType();

  // 스크롤할 때마다 지금 화면 위치 기억
  useEffect(() => {
    const save = () => positions.set(pathname, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [pathname]);

  useLayoutEffect(() => {
    const target = positions.get(pathname);
    // 처음 오는 화면(새로 연 화면)은 맨 위부터
    if (target === undefined) {
      if (type !== 'REPLACE') window.scrollTo(0, 0);
      return;
    }
    let tries = 0;
    let id = 0;
    const attempt = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= target || tries >= 20) {
        window.scrollTo(0, Math.min(target, Math.max(0, max)));
        return;
      }
      tries++;
      id = window.setTimeout(attempt, 50);
    };
    attempt();
    return () => window.clearTimeout(id);
    // 시트 여닫기(같은 주소, state만 바뀜)에는 반응하지 않게 pathname 기준
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
