import { routeColor } from './routeColor';
import { stampLook } from './stampLook';

export interface StampProps {
  /** 도장 안 큰 글자 (도시 영문 등, 도장 그림이라 대문자로 그린다) */
  city: string;
  /** 아래 작은 글자 ("2026.11") */
  period: string;
  /** 색 = 그 여행 1일차 노선 색 */
  dayIndex?: number;
  /** 모양·기울기를 정하는 값 (여행 id 등) — 같은 여행은 늘 같은 도장 */
  seed: string;
  /** 스크린리더 이름 ("도쿄 2026년 11월") */
  label: string;
}

/**
 * 여권 도장 (docs/29 §4.7, 사용자 결정 Q6) — 원·둥근 네모를 번갈아, −10°~+10° 기울기.
 * 도장 안 대문자 도시명은 그림 글자라 unslop "대문자 라벨 금지"의 예외
 */
export function Stamp({ city, period, dayIndex = 0, seed, label }: StampProps) {
  const { round, rotate, size } = stampLook(seed, city);
  const ink = routeColor(dayIndex).ink;
  const text = city.toUpperCase();
  return (
    <svg
      viewBox="0 0 80 80"
      role="img"
      aria-label={label}
      className="aspect-square w-full max-w-full"
      style={{ transform: `rotate(${rotate}deg)`, color: ink }}
    >
      {round ? (
        <>
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            opacity=".85"
          />
          <circle
            cx="40"
            cy="40"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity=".6"
          />
        </>
      ) : (
        <>
          <rect
            x="6"
            y="14"
            width="68"
            height="52"
            rx="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            opacity=".85"
          />
          <rect
            x="11"
            y="19"
            width="58"
            height="42"
            rx="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity=".6"
          />
        </>
      )}
      <text
        x="40"
        y="39"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={size}
        fontWeight="500"
        fill="currentColor"
        letterSpacing="1"
      >
        {text}
      </text>
      <text
        x="40"
        y="53"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="8.5"
        fill="currentColor"
        opacity=".85"
      >
        {period}
      </text>
    </svg>
  );
}
