import { APP_NAME, formatTripLength } from '@trippocket/shared';

// 1단계 확인용 시작 화면. 3단계(앱 셸)에서 라우터·탭으로 교체된다.
export function App() {
  return (
    <main className="start">
      <p className="start__badge">1단계 · 프로젝트 뼈대</p>
      <h1 className="start__title">{APP_NAME}</h1>
      <p className="start__desc">여행 일정을 주머니에 넣고 다니세요.</p>
      <p className="start__sample">
        예시 계산: 2026.10.24 – 10.28 ·{' '}
        <strong>{formatTripLength('2026-10-24', '2026-10-28')}</strong>
      </p>
    </main>
  );
}
