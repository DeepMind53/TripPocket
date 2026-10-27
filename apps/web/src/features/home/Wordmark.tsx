import { cn } from '../../shared/lib/cn';

// 글자마다 살짝 다른 기울기·높이 — 가방에 물건이 들쑥날쑥 담긴 느낌
const TILT = [-8, 5, -4, 7, 0, -6, 4, -3, 6, -5];
const LIFT = [0, -2, 1, -1, 2, -2, 1, 0, -1, 2];
const COLORS = ['text-day-1', 'text-day-2', 'text-day-3', 'text-day-4', 'text-day-5'];

/**
 * 홈 상단 로고 글자 "TripPocket". 'o'는 지도 핀, 위로 점선 비행 경로 + 작은 비행기.
 * 읽기용 이름은 label (한국어 앱 이름)
 */
export function Wordmark({ label }: { label: string }) {
  const letters = [...'TripPocket'];
  return (
    <h1 aria-label={label} className="relative flex items-end justify-center pt-3">
      {/* 점선 비행 경로 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 160 20"
        className="pointer-events-none absolute -top-0.5 left-1/2 h-5 w-40 -translate-x-1/2 text-fg-muted"
      >
        <path
          d="M6 17 C 45 -2, 110 -2, 148 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
        {/* 점선 끝 작은 비행기 (2026-10-27 화살표 → 비행기) */}
        <path
          d="M36 0C36-4 30-6 24-6H12L-6-34H-16L-4-6H-20L-28-18H-36L-30 0L-36 18H-28L-20 6H-4L-16 34H-6L12 6H24C30 6 36 4 36 0Z"
          transform="translate(150 12.5) rotate(25) scale(0.2)"
          className="fill-primary"
        />
      </svg>
      {letters.map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ transform: `rotate(${TILT[i]}deg) translateY(${LIFT[i]}px)` }}
          className={cn(
            'inline-block text-[26px] leading-none font-black tracking-tight',
            i < 4 ? 'text-primary' : COLORS[i % COLORS.length],
          )}
        >
          {ch === 'o' ? <Pin /> : ch}
        </span>
      ))}
    </h1>
  );
}

/** 'o' 자리의 지도 핀 */
function Pin() {
  return (
    <svg viewBox="0 0 20 26" className="inline-block h-[22px] w-[17px] align-[-2px]">
      <path
        d="M10 1a8.5 8.5 0 0 0-8.5 8.5C1.5 16 10 25 10 25s8.5-9 8.5-15.5A8.5 8.5 0 0 0 10 1z"
        className="fill-current"
      />
      <circle cx="10" cy="9.5" r="3.6" className="fill-bg" />
    </svg>
  );
}
