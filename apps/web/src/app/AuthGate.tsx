import { lazy, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useScrollMemory } from './useScrollMemory';
import { useAuth, wasSignedIn } from '../data/authStore';
import { Spinner } from '../shared/ui';
import { useStartScreen } from './useStartScreen';

const LoginPage = lazy(async () => ({
  default: (await import('../features/me/LoginPage')).LoginPage,
}));

const Loading = () => (
  <div className="flex min-h-dvh items-center justify-center">
    <Spinner />
  </div>
);

/**
 * 로그인한 사람만 앱을 쓴다 (2026-10-24 사용자 결정 — 외부인이 지도·AI 등 API를 쓰지 못하게).
 * - 로그인됨 → 그대로
 * - 이 기기에서 로그인한 적 있음 + 확인 중·오프라인 → 그대로 (오프라인 우선: 비행기 안에서도 열림)
 * - 로그인 안 됨(서버가 401) 또는 한 번도 로그인 안 한 기기 → 그 자리에서 로그인 화면 (로그인 후 이 주소로 돌아옴)
 *   주소를 옮기지 않는다 — 시트 닫기(뒤로 가기)와 겹쳐도 꼬이지 않게
 * 법적 고지·보기 전용 링크·초대 수락 화면은 router.tsx에서 이 밖에 둔다
 */
export function AuthGate() {
  const status = useAuth((s) => s.status);
  const loc = useLocation();
  // 설정 "앱을 열면" (홈·진행 중인 여행·마지막 화면)
  useStartScreen();
  // 화면마다 보던 위치 기억 — 탭을 오가도 보던 날짜로 (docs/20 U6)
  useScrollMemory();
  if (status === 'user' || (status !== 'anon' && wasSignedIn()))
    return (
      <>
        <Outlet />
      </>
    );
  if (status === 'unknown') return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <LoginPage returnTo={loc.pathname + loc.search} />
    </Suspense>
  );
}
