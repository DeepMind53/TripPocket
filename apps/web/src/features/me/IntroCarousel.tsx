import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

/**
 * 로그인 화면 앱 소개 (사용자 요청 2026-10-24): 옆으로 넘겨 보는 카드 4장.
 * 그림은 실제 화면을 본뜬 목업 — 샘플 데이터로 직접 그린다(이미지 파일 없음, 다크 모드도 그대로).
 * 넘기기는 CSS scroll-snap(라이브러리 없음), 아래 점을 눌러도 이동. 자동으로 넘어가지 않는다(읽는 속도는 사용자 몫)
 */
export function IntroCarousel() {
  const { t } = useTranslation();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides: { key: string; mock: ReactNode }[] = [
    { key: 'plan', mock: <PlanMock /> },
    { key: 'map', mock: <MapMock /> },
    { key: 'booking', mock: <BookingMock /> },
    { key: 'together', mock: <TogetherMock /> },
  ];
  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' });
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('intro.label')}
      className="flex flex-col gap-3"
    >
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="-mx-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div
            key={s.key}
            role="group"
            aria-roledescription="slide"
            aria-label={t('intro.slideOf', { n: i + 1, total: slides.length })}
            className="flex w-full shrink-0 snap-center flex-col items-center gap-3 px-5"
          >
            <div className="w-full max-w-[300px]" aria-hidden="true">
              {s.mock}
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <h2 className="text-title-2">{t(`intro.${s.key}.title` as 'intro.plan.title')}</h2>
              <p className="text-body-2 text-fg-sub">
                {t(`intro.${s.key}.desc` as 'intro.plan.desc')}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={t('intro.goTo', { n: i + 1 })}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => go(i)}
            className="grid size-6 place-items-center"
          >
            <span
              className={cn(
                'block h-2 rounded-full transition-all',
                i === index ? 'w-5 bg-primary' : 'w-2 bg-line',
              )}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

/** 휴대폰 화면 테두리 */
function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[22px] border-4 border-fg/10 bg-bg shadow-card">
      <div className="flex h-[216px] flex-col gap-2 overflow-hidden p-3">{children}</div>
    </div>
  );
}

const Pill = ({ color, children }: { color: string; children: ReactNode }) => (
  <span
    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
    style={{ background: color }}
  >
    {children}
  </span>
);

function Row({
  n,
  color,
  time,
  title,
  kind,
}: {
  n: number;
  color: string;
  time: string;
  title: string;
  kind: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-line/70 py-1.5 last:border-0">
      <span
        className="grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
        style={{ background: color }}
      >
        {n}
      </span>
      <span className="tabular w-8 shrink-0 text-[10px] font-semibold text-fg-sub">{time}</span>
      <span className="min-w-0 flex-1 truncate text-[11px]">{title}</span>
      <span className="shrink-0 rounded bg-bg-subtle px-1 text-[9px] text-fg-sub">{kind}</span>
    </div>
  );
}

const BLUE = '#2F6BFF';
const CORAL = '#FF6B4A';

function PlanMock() {
  return (
    <Phone>
      <div className="flex items-center gap-1 text-[11px] font-bold">🗼 도쿄 가을여행</div>
      <div className="flex flex-col rounded-xl border border-line bg-surface px-2">
        <div className="flex items-center gap-1.5 py-1.5">
          <Pill color={BLUE}>1일차</Pill>
          <span className="text-[11px] font-bold">10.27 (화)</span>
        </div>
        <Row n={1} color={BLUE} time="09:10" title="인천 → 나리타 KE703" kind="이동" />
        <Row n={2} color={BLUE} time="15:00" title="신주쿠 호텔 체크인" kind="숙소" />
        <Row n={3} color={BLUE} time="19:00" title="이치란 라멘" kind="맛집" />
      </div>
      <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-2 py-1.5">
        <Pill color={CORAL}>2일차</Pill>
        <span className="text-[10px] text-fg-muted">10.28 (수) · 일정 없음</span>
      </div>
    </Phone>
  );
}

function MapMock() {
  const pins: [number, number, string][] = [
    [40, 120, BLUE],
    [110, 70, BLUE],
    [190, 95, BLUE],
    [230, 40, CORAL],
  ];
  return (
    <Phone>
      <svg
        viewBox="0 0 260 150"
        className="h-full w-full rounded-xl bg-[#E8F0E6] dark:bg-[#1f2a22]"
      >
        <path
          d="M0 110 C 60 90, 120 130, 260 80"
          stroke="#ffffff"
          strokeWidth="10"
          fill="none"
          opacity="0.9"
        />
        <path d="M120 0 L 140 150" stroke="#ffffff" strokeWidth="7" fill="none" opacity="0.9" />
        <path d="M200 0 C 180 60, 230 100, 210 150" stroke="#BFD7F5" strokeWidth="12" fill="none" />
        <polyline
          points="40,120 110,70 190,95"
          fill="none"
          stroke={BLUE}
          strokeWidth="3"
          strokeDasharray="6 4"
        />
        {pins.map(([x, y, c], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="11" fill={c} stroke="#fff" strokeWidth="2.5" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
              {i < 3 ? i + 1 : 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1.5 text-[11px]">
        <span className="font-bold text-primary">‹</span>
        <span className="flex-1 truncate">2 / 4 · 센소지 · 걸어서 12분</span>
        <span className="font-bold text-primary">›</span>
      </div>
    </Phone>
  );
}

function BookingMock() {
  return (
    <Phone>
      <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-2">
        <div className="flex justify-between text-[10px] text-fg-sub">
          <span>✈ 대한항공 KE703</span>
          <span>10.27 (화)</span>
        </div>
        <div className="tabular flex items-center gap-2">
          <span className="flex flex-col">
            <span className="text-[18px] leading-none font-bold">ICN</span>
            <span className="text-[10px] text-fg-sub">09:10 · T2</span>
          </span>
          <span className="h-px flex-1 border-t border-dashed border-fg-muted" />
          <span className="text-[12px]">✈</span>
          <span className="h-px flex-1 border-t border-dashed border-fg-muted" />
          <span className="flex flex-col items-end">
            <span className="text-[18px] leading-none font-bold">NRT</span>
            <span className="text-[10px] text-fg-sub">11:30 · T1</span>
          </span>
        </div>
        <span className="self-start rounded bg-bg-subtle px-1.5 font-mono text-[10px]">
          예약번호 AB12CD ⧉
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-2">
        <div className="flex justify-between text-[11px] font-bold">
          <span>🧳 준비물</span>
          <span className="tabular text-primary">12 / 30</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
          <div className="h-full w-2/5 rounded-full bg-primary" />
        </div>
        <span className="text-[10px] text-fg-sub">☑ 여권 · ☑ 엔화 · ☐ 돼지코</span>
      </div>
    </Phone>
  );
}

function TogetherMock() {
  return (
    <Phone>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold">🗼 도쿄 가을여행</span>
        <span className="rounded-full bg-primary-weak px-2 py-0.5 text-[10px] font-semibold text-primary">
          👥 3
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-2 text-[10px]">
        <span>진하 · 수정 · 소유자</span>
        <span>야멍 · 수정</span>
        <span className="text-fg-muted">민지 · 보기만</span>
      </div>
      <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface p-2">
        <span className="text-[11px] font-bold">✨ 신주쿠역 근처 맛집 · 5km 안</span>
        <span className="text-[10px]">1 이치란 신주쿠점 · 블로그 7회 언급</span>
        <span className="text-[10px] text-fg-sub">진한 돈코츠 국물, 줄 서도 먹는 곳</span>
      </div>
    </Phone>
  );
}
