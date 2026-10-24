import { getTripStatus, todayIn } from '@trippocket/shared';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { tripRepo } from '../data/repositories/tripRepo';
import { useSettings } from '../data/settingsStore';

const LAST_KEY = 'tp-last-path';
const STARTED_KEY = 'tp-started';

/**
 * 설정 "앱을 열면" (2026-10-24): 홈 / 진행 중인 여행의 일정 / 마지막으로 본 화면.
 * 앱을 처음 열어 홈(/)일 때 한 번만 옮긴다 (홈 탭을 눌러 온 경우는 그대로). 마지막 화면은 기기에 저장
 */
export function useStartScreen(): void {
  const loc = useLocation();
  const navigate = useNavigate();
  const loaded = useSettings((s) => s.loaded);
  const start = useSettings((s) => s.startScreen);

  // 지금 화면 기억 (홈·로그인 제외)
  useEffect(() => {
    if (loc.pathname === '/' || loc.pathname.startsWith('/login')) return;
    try {
      localStorage.setItem(LAST_KEY, loc.pathname + loc.search);
    } catch {
      // 기억 못 해도 다음에 홈으로 열릴 뿐
    }
  }, [loc.pathname, loc.search]);

  useEffect(() => {
    if (!loaded) return;
    let first: boolean;
    try {
      first = sessionStorage.getItem(STARTED_KEY) === null;
      sessionStorage.setItem(STARTED_KEY, '1');
    } catch {
      first = false;
    }
    if (!first || loc.pathname !== '/' || start === 'home') return;
    if (start === 'last') {
      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_KEY);
      } catch {
        // 기억이 없으면 홈
      }
      if (last && last.startsWith('/')) void navigate(last, { replace: true });
      return;
    }
    // 진행 중인 여행 (여럿이면 먼저 시작한 것)
    void tripRepo.listActive().then((trips) => {
      const trip = trips
        .filter((t) => getTripStatus(t.startDate, t.endDate, todayIn(t.timezone)) === 'ongoing')
        .sort((x, y) => x.startDate.localeCompare(y.startDate))[0];
      if (trip) void navigate(`/trips/${trip.id}/plan`, { replace: true });
    });
    // 처음 한 번만 — 설정이 불러와졌을 때
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
}
