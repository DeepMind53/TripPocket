import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';

/**
 * 로그인 화면 앱 소개 (사용자 요청 2026-10-24): 옆으로 넘겨 보는 카드 8장 (2026-10-26 3장, 10-27 방문 기록 1장 추가, 홈 [도움말]에서도).
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
    { key: 'visit', mock: <VisitMock /> },
    { key: 'quick', mock: <QuickMock /> },
    { key: 'alerts', mock: <AlertsMock /> },
    { key: 'together', mock: <TogetherMock /> },
    { key: 'records', mock: <RecordsMock /> },
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
      <div className="flex h-[240px] flex-col gap-2 overflow-hidden p-3">{children}</div>
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
  label,
}: {
  n: number;
  color: string;
  time: string;
  title: string;
  /** 일정 종류 — 실제 화면처럼 종류별 연한 바탕 (styles/index.css .kind-tint) */
  kind: string;
  label: string;
}) {
  return (
    <div
      className="kind-tint flex items-center gap-2 rounded-lg px-1.5 py-1"
      style={{ '--kind': `var(--tp-kind-${kind})` } as CSSProperties}
    >
      <span
        className="grid size-4 shrink-0 place-items-center rounded-full text-[9px] leading-none font-bold text-white"
        style={{ background: color }}
      >
        {n}
      </span>
      <span className="tabular w-8 shrink-0 text-[10px] font-semibold whitespace-nowrap text-fg-sub">
        {time}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px]">{title}</span>
      <span className="shrink-0 rounded bg-bg-subtle px-1 text-[9px] text-fg-sub">{label}</span>
    </div>
  );
}

const BLUE = '#2F6BFF';
const CORAL = '#FF6B4A';

/** 일정 화면: 날짜 칩 줄 + 날짜 카드(회색 머리·왼쪽 색 띠) + 종류별 바탕 일정 + 빈 날 접기 */
function PlanMock() {
  return (
    <Phone>
      <span className="text-[11px] font-bold">🇯🇵 도쿄 가을여행 · D-3</span>
      <div className="flex gap-1 text-[9px]">
        <span className="rounded-full bg-primary-weak px-1.5 py-0.5 font-semibold text-primary">
          전체
        </span>
        <span className="rounded-full border border-line px-1.5 py-0.5">
          <span style={{ color: BLUE }}>●</span> 1일차 10.27
        </span>
        <span className="rounded-full border border-line px-1.5 py-0.5">
          <span style={{ color: CORAL }}>●</span> 2일차 10.28
        </span>
      </div>
      <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
        <div
          className="flex items-center gap-1.5 border-b border-line bg-bg-subtle/60 px-2 py-1"
          style={{ boxShadow: `inset 3px 0 0 ${BLUE}` }}
        >
          <Pill color={BLUE}>1일차</Pill>
          <span className="text-[11px] font-bold">10.27 (화)</span>
        </div>
        <div className="flex flex-col gap-1 p-1.5">
          <Row
            n={1}
            color={BLUE}
            time="09:10"
            title="인천 → 나리타"
            kind="transport"
            label="이동"
          />
          <Row n={2} color={BLUE} time="15:00" title="신주쿠 호텔" kind="lodging" label="숙소" />
          <Row n={3} color={BLUE} time="19:00" title="이치란 라멘" kind="food" label="맛집" />
        </div>
      </div>
    </Phone>
  );
}

/** 지도 크게 보기: 일차 색 핀·순서선 + 아래 한 개씩 넘기는 일정 */
function MapMock() {
  const pins: [number, number][] = [
    [40, 80],
    [110, 40],
    [190, 62],
  ];
  return (
    <Phone>
      <svg viewBox="0 0 260 105" className="w-full rounded-xl bg-[#E8F0E6] dark:bg-[#1f2a22]">
        <path
          d="M0 80 C 60 60, 120 95, 260 55"
          stroke="#ffffff"
          strokeWidth="9"
          fill="none"
          opacity="0.9"
        />
        <path d="M120 0 L 135 105" stroke="#ffffff" strokeWidth="6" fill="none" opacity="0.9" />
        <path d="M205 0 C 185 40, 230 70, 212 105" stroke="#BFD7F5" strokeWidth="11" fill="none" />
        <polyline
          points="40,80 110,40 190,62"
          fill="none"
          stroke={BLUE}
          strokeWidth="3"
          strokeDasharray="6 4"
        />
        {pins.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="10" fill={BLUE} stroke="#fff" strokeWidth="2.5" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-1.5">
        <div className="flex items-center justify-between px-1 text-[10px]">
          <span className="font-bold text-primary">‹</span>
          <span className="tabular text-fg-sub">1일차 · 10.27 (화) · 2 / 3</span>
          <span className="font-bold text-primary">›</span>
        </div>
        <Row n={2} color={BLUE} time="15:00" title="신주쿠 호텔" kind="lodging" label="숙소" />
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
  const members: [string, string][] = [
    ['하늘', '소유자'],
    ['구름', '수정'],
    ['민지', '보기만'],
  ];
  return (
    <Phone>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold">🇯🇵 도쿄 가을여행</span>
        <span className="rounded-full bg-primary-weak px-2 py-0.5 text-[10px] font-semibold text-primary">
          👥 3
        </span>
      </div>
      <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface px-2 text-[10px]">
        {members.map(([name, role]) => (
          <span key={name} className="flex justify-between py-1">
            <span className="font-semibold">{name}</span>
            <span className="text-fg-muted">{role}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface p-2 leading-tight">
        <span className="text-[11px] font-bold">✨ 신주쿠역 근처 맛집</span>
        <span className="text-[10px]">1 이치란 신주쿠점 · 블로그 7회</span>
        <span className="truncate text-[9px] text-fg-muted">진한 돈코츠 국물, 줄 서도 먹는 곳</span>
      </div>
    </Phone>
  );
}

/** 빠른 메뉴: 긴급·환율·AI 추천·회화 2×2 + 여행 안 바로가기 4개 (실제 시트와 같은 순서, 2026-10-27) */
function QuickMock() {
  const links: [string, string, string, boolean][] = [
    ['🚨', '긴급 연락처', '경찰·구급·영사콜센터', false],
    ['💱', '환율', '원화로 바로 계산', false],
    ['✨', 'AI 추천', '근처 맛집·핫플', true],
    ['🗣', '번역·회화', '현지어로 크게 보여 주기', false],
  ];
  const shortcuts = ['🛏 숙소로 길찾기', '🎫 예약번호', '🗓 다음 일정', '☑ 준비물'];
  return (
    <Phone>
      <span className="text-[11px] font-bold">⚡ 빠른 메뉴</span>
      <div className="grid grid-cols-2 gap-1">
        {links.map(([e, title, desc, ai]) => (
          <span
            key={title}
            className={cn(
              'flex flex-col rounded-lg px-2 py-1 leading-tight',
              ai ? 'bg-primary-weak' : 'bg-bg-subtle',
            )}
          >
            <span className="truncate text-[10px] font-semibold">
              {e} {title}
            </span>
            <span className="truncate text-[9px] text-fg-muted">{desc}</span>
          </span>
        ))}
      </div>
      <span className="text-[9px] font-bold text-fg-muted">바로가기</span>
      <div className="grid grid-cols-2 gap-1">
        {shortcuts.map((label) => (
          <span
            key={label}
            className="truncate rounded-lg bg-bg-subtle px-2 py-0.5 text-[9px] font-semibold"
          >
            {label}
          </span>
        ))}
      </div>
    </Phone>
  );
}

/** 여행 중 일정: 지난 일정 오른쪽 [방문][미방문] + 미방문 빗금 + 다음 일정 바 (2026-10-27) */
function VisitMock() {
  return (
    <Phone>
      <span className="text-[11px] font-bold">🇯🇵 도쿄 가을여행 · 오늘</span>
      <div className="flex flex-col px-1 text-[9px] leading-tight">
        <span className="truncate text-[10px] font-semibold">다음 19:00 이치란 라멘</span>
        <span className="text-fg-sub">도보 35분 · 18:25 출발</span>
        <span className="text-fg-sub">대중교통 14분 · 18:46 출발</span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-1.5">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <Row n={1} color={BLUE} time="10:00" title="센소지" kind="place" label="관광" />
          </div>
          <span className="flex flex-col gap-0.5 text-[8px] font-semibold">
            <span className="rounded bg-primary px-1 text-white">방문</span>
            <span className="rounded border border-line px-1 text-fg-sub">미방문</span>
          </span>
        </div>
        <div className="relative">
          <Row n={2} color={BLUE} time="14:00" title="스카이트리" kind="place" label="관광" />
          <span className="pointer-events-none absolute inset-0 rounded-lg bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgb(0_0_0/0.08)_5px_7px)]" />
        </div>
        <span className="self-end text-[9px] text-fg-muted">미방문 기록 → 저장 탭에 담김</span>
        <Row n={3} color={BLUE} time="19:00" title="이치란 라멘" kind="food" label="맛집" />
      </div>
    </Phone>
  );
}

function AlertsMock() {
  const notes: [string, string, string][] = [
    ['✈', '내일 출발이에요', '여권·충전기 챙겼나요'],
    ['🛂', '입국신고 할 때예요', 'Visit Japan Web 미리 등록'],
    ['⏰', '30분 뒤 센소지', '걸어서 12분'],
  ];
  return (
    <Phone>
      {notes.map(([e, title, sub]) => (
        <div
          key={title}
          className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary-weak text-[12px]">
            {e}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[11px] font-bold">{title}</span>
            <span className="truncate text-[10px] text-fg-sub">{sub}</span>
          </span>
        </div>
      ))}
      <span className="self-center rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] text-fg-sub">
        📶 인터넷이 없어도 일정·예약은 그대로
      </span>
    </Phone>
  );
}

/** 기록 탭: 나의 여행 통계(회색 칸) + 가 본 나라 국기 + 다녀온 여행 */
function RecordsMock() {
  return (
    <Phone>
      <span className="text-[9px] font-bold text-fg-muted">나의 여행</span>
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            ['다녀온 여행', '4번'],
            ['여행한 날', '17일'],
            ['가 본 나라', '3곳'],
          ] as const
        ).map(([k, v]) => (
          <span key={k} className="flex flex-col items-center rounded-xl bg-bg-subtle py-1.5">
            <span className="tabular text-[13px] font-bold">{v}</span>
            <span className="text-[9px] text-fg-muted">{k}</span>
          </span>
        ))}
      </div>
      <span className="text-[18px] leading-none">🇯🇵 🇹🇼 🇹🇭</span>
      <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface p-2 leading-tight">
        <span className="text-[11px] font-bold">🇯🇵 도쿄 가을여행 · 10.27~10.30</span>
        <span className="text-[10px] text-rating">★★★★★ 이치란 라멘</span>
        <span className="self-start rounded-full bg-primary-weak px-1.5 text-[9px] font-semibold text-primary">
          리뷰 남기면 +100P
        </span>
      </div>
    </Phone>
  );
}
