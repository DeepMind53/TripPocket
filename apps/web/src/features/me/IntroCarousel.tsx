import {
  ArrowLeftRight,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coffee,
  IdCard,
  Landmark,
  Languages,
  ListChecks,
  Plane,
  Siren,
  Sparkles,
  Ticket,
  TriangleAlert,
  Users,
  Utensils,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import {
  DAY_INK_HEX,
  DAY_LINE_HEX,
  NextStopCard,
  routeColor,
  RouteLine,
  RouteStop,
  Stamp,
  TicketCard,
  TransferChip,
} from '../../shared/ui';

/**
 * 로그인 화면 앱 소개 (사용자 요청 2026-10-24): 옆으로 넘겨 보는 카드 8장 (2026-10-26 3장, 10-27 방문 기록 1장 추가, 홈 [도움말]에서도).
 * 그림은 실제 화면 부품(노선·다음 역 카드·탑승권·여권 도장, docs/29)에 샘플 데이터를 넣어 그린다 (2026-11-12 —
 * 손으로 흉내 낸 그림이 디자인 개편 뒤 옛 모양으로 남아 있었음). 이미지 파일 없음, 다크 모드도 그대로.
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
            <div className="w-full max-w-[300px]" aria-hidden="true" inert>
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
                'block h-2 rounded-full transition-[width,background-color] duration-200 ease-soft',
                i === index ? 'w-5 bg-primary' : 'w-2 bg-line',
              )}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

/** 휴대폰 화면 테두리 — 안은 실제 화면 크기 그대로 그리고 넘치는 아래쪽은 잘린다 */
function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[22px] border-4 border-fg/10 bg-bg shadow-card">
      <div className="flex h-[260px] flex-col gap-2.5 overflow-hidden p-3 [&>*]:shrink-0">
        {children}
      </div>
    </div>
  );
}

/** 일정 줄 보조줄: 종류 아이콘 칸 + 종류 (PlanPage 일정 줄과 같은 모양) */
function KindMeta({ kind, icon: Icon, label }: { kind: string; icon: LucideIcon; label: string }) {
  return (
    <span
      className="flex items-center gap-1.5"
      style={{ '--kind': `var(--tp-kind-${kind})` } as CSSProperties}
    >
      <span className="grid size-5 shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--kind)_16%,var(--tp-surface))] text-[var(--kind)]">
        <Icon className="size-3.5" />
      </span>
      {label}
    </span>
  );
}

/** 일차 칩 (PlanPage: 고르면 노선 진한 색 채움, 아니면 노선 색 테두리) */
function DayChip({ day, label, on }: { day: number | null; label: string; on?: boolean }) {
  const c = day === null ? null : routeColor(day);
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border-[1.5px] px-2.5 py-0.5 text-caption whitespace-nowrap',
        !c && 'border-line text-fg-sub',
      )}
      style={
        c
          ? on
            ? { background: c.ink, borderColor: c.ink, color: 'var(--tp-on-primary)' }
            : { borderColor: c.line, color: c.ink }
          : undefined
      }
    >
      {c && <span className="size-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}

/** 일정: 일차 칩 + 일차 머리 + 노선(역 점·환승 알약) */
function PlanMock() {
  return (
    <Phone>
      <span className="text-body-2 font-semibold">🗼 도쿄 가을여행</span>
      <div className="flex gap-1.5 overflow-hidden">
        <DayChip day={null} label="전체" />
        <DayChip day={0} label="1일차 10.27" on />
        <DayChip day={1} label="2일차 10.28" />
      </div>
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <span
          className="rounded-full px-2 py-0.5 text-caption font-semibold text-on-primary"
          style={{ background: routeColor(0).ink }}
        >
          1일차
        </span>
        <span className="text-body-2 font-semibold">10.27 (화)</span>
      </div>
      <RouteLine label="1일차 노선" dayIndex={0}>
        <RouteStop
          number={1}
          title="센소지"
          time="10:00"
          meta={<KindMeta kind="place" icon={Landmark} label="관광" />}
        />
        <TransferChip>걸어서 약 12분</TransferChip>
        <RouteStop
          number={2}
          title="이치란 라멘"
          time="12:30"
          meta={<KindMeta kind="food" icon={Utensils} label="맛집" />}
        />
        <RouteStop
          number={3}
          title="블루보틀 기요스미"
          time="15:00"
          meta={<KindMeta kind="cafe" icon={Coffee} label="카페" />}
        />
      </RouteLine>
    </Phone>
  );
}

/** 지도 크게 보기: 노선 색 고리 핀(흰 바탕·진한 번호)·점선 경로 + 아래 한 개씩 넘기는 일정 */
function MapMock() {
  const pins: [number, number][] = [
    [40, 82],
    [112, 40],
    [196, 64],
  ];
  const line = DAY_LINE_HEX[0];
  const ink = DAY_INK_HEX[0];
  return (
    <Phone>
      <svg viewBox="0 0 260 110" className="w-full rounded-xl bg-[#E8F0E6] dark:bg-[#1f2a22]">
        <path
          d="M0 84 C 60 64, 120 99, 260 59"
          stroke="#ffffff"
          strokeWidth="9"
          fill="none"
          opacity="0.9"
        />
        <path d="M120 0 L 135 110" stroke="#ffffff" strokeWidth="6" fill="none" opacity="0.9" />
        <path d="M210 0 C 190 40, 235 72, 216 110" stroke="#BFD7F5" strokeWidth="11" fill="none" />
        <polyline
          points={pins.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke={line}
          strokeWidth="3"
          strokeDasharray="6 4"
        />
        {pins.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="11" fill="#fff" stroke={line} strokeWidth="3" />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={ink}
              fontFamily="var(--font-mono)"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-col gap-1 rounded-card border border-line bg-surface px-3 pt-2">
        <div className="flex items-center justify-between text-caption text-fg-sub">
          <ChevronLeft className="size-4 text-primary" />
          <span className="tabular">1일차 · 2 / 3</span>
          <ChevronRight className="size-4 text-primary" />
        </div>
        <RouteLine label="1일차 노선" dayIndex={0}>
          <RouteStop
            number={2}
            title="이치란 라멘"
            time="12:30"
            meta={<KindMeta kind="food" icon={Utensils} label="맛집" />}
          />
        </RouteLine>
      </div>
    </Phone>
  );
}

/** 예약: 탑승권(절취선·큰 코드·3칸) + 준비물 진행 칸 */
function BookingMock() {
  return (
    <Phone>
      <TicketCard
        header="대한항공 KE703 · 10.27 (화)"
        from={{ code: 'ICN', sub: '09:10 · T2' }}
        to={{ code: 'NRT', sub: '11:30 · T1' }}
        cells={[
          { label: '예약번호', value: 'AB12CD', accent: true },
          { label: '좌석', value: '32A' },
          { label: '수하물', value: '23kg' },
        ]}
      />
      <div className="flex flex-col gap-2 rounded-card bg-bg-subtle px-4 py-3">
        <div className="flex items-baseline justify-between text-body-2 font-semibold">
          <span>12/30 챙겼어요</span>
          <span className="tabular text-caption font-medium text-fg-muted">40%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full w-2/5 rounded-full bg-success" />
        </div>
      </div>
    </Phone>
  );
}

/** 여행 중: 다음 역 카드(파랑) + 지난 일정 [미방문][방문] */
function VisitMock() {
  const toggle = (on: 'visited' | 'skipped') => (
    <span className="flex gap-1">
      {(['skipped', 'visited'] as const).map((v) => (
        <span
          key={v}
          className={cn(
            'grid h-7 place-items-center rounded-btn border px-2 text-caption font-semibold',
            on === v
              ? v === 'visited'
                ? 'border-primary bg-primary text-on-primary'
                : 'border-fg-muted bg-fg-muted text-surface'
              : 'border-line bg-surface text-fg-sub',
          )}
        >
          {v === 'visited' ? '방문' : '미방문'}
        </span>
      ))}
    </span>
  );
  return (
    <Phone>
      <NextStopCard
        label="다음 일정"
        kicker="다음 일정 · 18:36 전 출발"
        title="이치란 라멘"
        countdown="35분 후"
        progress={0.6}
        from="스카이트리"
        to="이치란 라멘"
      />
      <RouteLine label="오늘 노선" dayIndex={1}>
        <RouteStop
          number={1}
          state="past"
          mark="visited"
          title="센소지"
          time="10:00"
          dense
          trailing={toggle('visited')}
        />
        <RouteStop
          number={2}
          state="past"
          mark="skipped"
          title="스카이트리"
          time="14:00"
          dense
          trailing={toggle('skipped')}
        />
      </RouteLine>
    </Phone>
  );
}

/** 빠른 메뉴: 긴급·환율·AI 추천·회화 2×2 + 바로가기 4개 (실제 시트와 같은 순서·모양) */
function QuickMock() {
  const links: [LucideIcon, string, string, string][] = [
    [Siren, '긴급 연락처', '경찰·구급·영사콜센터', 'border border-danger/40'],
    [ArrowLeftRight, '환율', '원화로 바로 계산', 'bg-bg-subtle'],
    [Sparkles, 'AI 추천', '근처 맛집·핫플', 'bg-primary-weak'],
    [Languages, '번역·회화', '현지어로 크게', 'bg-bg-subtle'],
  ];
  const shortcuts: [LucideIcon, string][] = [
    [BedDouble, '숙소로 길찾기'],
    [Ticket, '예약번호'],
    [CalendarDays, '다음 일정'],
    [ListChecks, '준비물'],
  ];
  return (
    <Phone>
      <div className="flex items-baseline justify-between">
        <span className="text-body-1 font-semibold">빠른 메뉴</span>
        <span className="tabular text-caption text-fg-sub">현지 10.27 (화) 14:20</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {links.map(([Icon, title, desc, tone], i) => (
          <span key={title} className={cn('flex flex-col gap-0.5 rounded-card px-2.5 py-2', tone)}>
            <span className="flex items-center gap-1 text-caption font-semibold">
              <Icon className={cn('size-4 shrink-0', i === 0 ? 'text-danger' : 'text-primary')} />
              <span className="truncate">{title}</span>
            </span>
            <span className="truncate text-micro text-fg-muted">{desc}</span>
          </span>
        ))}
      </div>
      <span className="text-caption text-fg-sub">바로가기</span>
      <div className="grid grid-cols-2 gap-1.5">
        {shortcuts.map(([Icon, label]) => (
          <span
            key={label}
            className="flex h-9 items-center gap-1.5 rounded-btn bg-bg-subtle px-2.5 text-caption font-semibold"
          >
            <Icon className="size-4 shrink-0 text-primary" />
            <span className="truncate">{label}</span>
          </span>
        ))}
      </div>
    </Phone>
  );
}

function AlertsMock() {
  const notes: [LucideIcon, string, string][] = [
    [Plane, '내일 출발이에요', '여권·충전기 챙겼나요'],
    [IdCard, '입국신고 할 때예요', 'Visit Japan Web 미리 등록'],
    [TriangleAlert, '여행지 특보', '태풍 경보 · 공식 발표 확인'],
  ];
  return (
    <Phone>
      {notes.map(([Icon, title, sub]) => (
        <div
          key={title}
          className="flex items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-btn bg-primary-weak text-primary">
            <Icon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body-2 font-semibold">{title}</span>
            <span className="truncate text-caption text-fg-sub">{sub}</span>
          </span>
        </div>
      ))}
      <span className="flex items-center gap-1 self-center rounded-full bg-bg-subtle px-2.5 py-1 text-caption text-fg-sub">
        <WifiOff className="size-3.5 shrink-0" />
        인터넷이 없어도 일정은 그대로
      </span>
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
        <span className="text-body-2 font-semibold">🗼 도쿄 가을여행</span>
        <span className="flex items-center gap-1 rounded-full bg-primary-weak px-2 py-0.5 text-caption font-semibold text-primary">
          <Users className="size-3.5" /> 3
        </span>
      </div>
      <div className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface px-3 text-caption">
        {members.map(([name, role]) => (
          <span key={name} className="flex justify-between py-1.5">
            <span className="font-semibold">{name}</span>
            <span className="text-fg-muted">{role}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 rounded-card border border-line bg-surface px-3 py-2">
        <span className="flex items-center gap-1 text-body-2 font-semibold">
          <Sparkles className="size-4 text-primary" />
          신주쿠역 근처 맛집
        </span>
        <span className="text-caption">1 이치란 신주쿠점 · 블로그 7회</span>
        <span className="truncate text-caption text-fg-muted">
          진한 돈코츠 국물, 줄 서도 먹는 곳
        </span>
      </div>
    </Phone>
  );
}

/** 기록: 나의 여행 숫자 + 가 본 나라 여권 도장 (RecordsPage·CountryGrid와 같은 부품) */
function RecordsMock() {
  // [나라, 도장 모양 seed, 다녀온 횟수, 노선 색] — 횟수 합 = 다녀온 여행 4번
  const stamps: [string, string, number, number][] = [
    ['일본', 'JP', 2, 1],
    ['대만', 'TW', 1, 0],
    ['태국', 'TH', 1, 3],
  ];
  return (
    <Phone>
      <span className="text-body-2 font-semibold">나의 여행</span>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['4번', '다녀온 여행'],
            ['17일', '여행한 날'],
            ['3곳', '가 본 나라'],
          ] as const
        ).map(([v, k]) => (
          <span key={k} className="flex flex-col">
            <span className="tabular text-title-2">{v}</span>
            <span className="text-caption text-fg-muted">{k}</span>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 px-1">
        {stamps.map(([name, cc, n, day]) => (
          <Stamp key={cc} city={name} period={`${n}번`} dayIndex={day} seed={cc} label={name} />
        ))}
      </div>
      <span className="self-start rounded-full bg-primary-weak px-2 py-0.5 text-caption font-semibold text-primary">
        리뷰 남기면 +100P
      </span>
    </Phone>
  );
}
