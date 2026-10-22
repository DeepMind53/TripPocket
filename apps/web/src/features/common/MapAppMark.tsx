import type { MapApp } from '../../shared/lib/directions';

const MARK: Record<MapApp, { bg: string; fg: string; letter: string }> = {
  naver: { bg: '#03C75A', fg: '#FFFFFF', letter: 'N' },
  google: { bg: '#4285F4', fg: '#FFFFFF', letter: 'G' },
  kakao: { bg: '#FEE500', fg: '#191F28', letter: 'K' },
};

/** 지도 앱 표시 (브랜드 색 사각형 + 머리글자) */
export function MapAppMark({ app }: { app: MapApp }) {
  const m = MARK[app];
  return (
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-lg text-caption font-extrabold"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.letter}
    </span>
  );
}
