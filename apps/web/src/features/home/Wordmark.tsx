/**
 * 홈 상단 로고 글자 "TripPocket" (unslop 2026-11-09: 글자별 기울기·5색 → 한 줄 두 색).
 * "Trip"은 본문색, "Pocket"은 브랜드 파랑. 'o'는 지도 핀, 위로 점선 비행 경로 + 작은 비행기 (앱 아이콘과 같은 모양).
 * 읽기용 이름은 label (한국어 앱 이름)
 */
export function Wordmark({ label }: { label: string }) {
  return (
    <h1
      aria-label={label}
      className="relative flex items-end justify-center pt-3 text-[24px] leading-none font-semibold tracking-[-0.02em] whitespace-nowrap"
    >
      {/* 점선 비행 경로 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 160 20"
        className="pointer-events-none absolute -top-1 left-1/2 h-5 w-36 -translate-x-1/2 text-line"
      >
        <path
          d="M6 17 C 45 -2, 110 -2, 148 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2 4"
          strokeLinecap="round"
        />
        <path
          d="M36 0C36-4 30-6 24-6H12L-6-34H-16L-4-6H-20L-28-18H-36L-30 0L-36 18H-28L-20 6H-4L-16 34H-6L12 6H24C30 6 36 4 36 0Z"
          transform="translate(150 12.5) rotate(25) scale(0.2)"
          className="fill-primary"
        />
      </svg>
      <span aria-hidden="true" className="text-fg">
        Trip
      </span>
      <span aria-hidden="true" className="text-primary">
        P<Pin />
        cket
      </span>
    </h1>
  );
}

/** 'o' 자리의 지도 핀 */
function Pin() {
  return (
    <svg viewBox="0 0 20 26" className="mx-[0.5px] inline-block h-[19px] w-[14.5px] align-[-1px]">
      <path
        d="M10 1a8.5 8.5 0 0 0-8.5 8.5C1.5 16 10 25 10 25s8.5-9 8.5-15.5A8.5 8.5 0 0 0 10 1z"
        className="fill-current"
      />
      <circle cx="10" cy="9.5" r="3.4" className="fill-bg" />
    </svg>
  );
}
