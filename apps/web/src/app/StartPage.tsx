import { APP_NAME, formatTripLength } from '@trippocket/shared';
import { Link } from 'react-router';

// 2단계 확인용 시작 화면. 3단계(앱 셸)에서 홈 탭으로 교체된다.
export function StartPage() {
  return (
    <main className="grid min-h-dvh place-content-center gap-2 px-5 py-6 text-center">
      <p className="text-caption font-semibold text-primary">2단계 · 디자인 토큰과 기본 컴포넌트</p>
      <h1 className="text-display">{APP_NAME}</h1>
      <p className="text-body-2 text-fg-sub">여행 일정을 주머니에 넣고 다니세요.</p>
      <p className="text-body-2 text-fg-sub">
        예시 계산: 2026.10.24 – 10.28 ·{' '}
        <strong className="text-fg">{formatTripLength('2026-10-24', '2026-10-28')}</strong>
      </p>
      <Link
        to="/dev/ui"
        className="mx-auto mt-4 inline-flex h-11 items-center rounded-btn bg-primary px-4 font-semibold text-on-primary"
      >
        컴포넌트 미리보기
      </Link>
    </main>
  );
}
