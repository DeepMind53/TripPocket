import { ArrowLeft, Bed, Bell, Copy, Heart, MapPin, Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { applyTheme, type ThemePref } from '../../shared/lib/theme';
import {
  BottomSheet,
  Button,
  Chip,
  IconButton,
  RadioList,
  SegmentedControl,
  Slider,
  Stepper,
  Switch,
  snackbar,
  toast,
} from '../../shared/ui';

/**
 * 컴포넌트 미리보기 (개발 전용, 2단계 확인용).
 * 실제 화면이 아니라 디자인 토큰·컴포넌트가 의도대로 보이고 동작하는지 확인하는 페이지.
 */
export function DevUiPage() {
  const [theme, setTheme] = useState<ThemePref>('system');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>(['food']);
  const [timeFormat, setTimeFormat] = useState<'24h' | '12h'>('24h');
  const [mapApp, setMapApp] = useState<'naver' | 'google' | 'kakao' | 'ask'>('ask');
  const [haptics, setHaptics] = useState(true);
  const [backupDays, setBackupDays] = useState(14);
  const [fontStep, setFontStep] = useState(1);
  const [radius, setRadius] = useState(3);
  const [loading, setLoading] = useState(false);

  const fontNames = ['작게', '보통', '크게', '아주 크게'] as const;
  const fontScales = [0.9, 1, 1.15, 1.3] as const;

  function toggleCategory(id: string) {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-line bg-bg/90 px-2 py-1 backdrop-blur pt-[env(safe-area-inset-top)]">
        <Link
          to="/"
          aria-label="시작 화면으로"
          className="grid size-11 place-items-center text-fg-sub"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="flex-1 text-title-2">컴포넌트 미리보기</h1>
        <IconButton
          label="빠른 메뉴(예시)"
          icon={<Zap />}
          tone="tint"
          onClick={() => toast('3단계에서 연결돼요')}
        />
      </header>

      <div className="flex flex-col gap-8 px-5 pt-5">
        <Section title="테마" hint="시스템을 고르면 기기 설정(라이트/다크)을 따라가요">
          <SegmentedControl
            label="테마"
            value={theme}
            onChange={(v) => {
              setTheme(v);
              applyTheme(v);
            }}
            options={[
              { value: 'light', label: '라이트' },
              { value: 'dark', label: '다크' },
              { value: 'system', label: '시스템' },
            ]}
          />
        </Section>

        <Section title="색">
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ['primary', 'bg-primary'],
                ['primary-weak', 'bg-primary-weak'],
                ['bg-subtle', 'bg-bg-subtle'],
                ['surface', 'bg-surface'],
                ['line', 'bg-line'],
                ['fg', 'bg-fg'],
                ['fg-sub', 'bg-fg-sub'],
                ['fg-muted', 'bg-fg-muted'],
                ['success', 'bg-success'],
                ['warning', 'bg-warning'],
                ['danger', 'bg-danger'],
                ['rating', 'bg-rating'],
              ] as const
            ).map(([name, cls]) => (
              <Swatch key={name} name={name} className={cls} />
            ))}
          </div>
          <p className="mt-3 text-caption text-fg-muted">
            일차 색 (지도 핀·Day 칩, 9일차부터 반복)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                'bg-day-1',
                'bg-day-2',
                'bg-day-3',
                'bg-day-4',
                'bg-day-5',
                'bg-day-6',
                'bg-day-7',
                'bg-day-8',
              ] as const
            ).map((cls, i) => (
              <span
                key={cls}
                className={`tabular grid size-8 place-items-center rounded-full text-micro text-white ${cls}`}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </Section>

        <Section title="글자">
          <div className="flex flex-col gap-2">
            <p className="text-display">어디로 떠나세요?</p>
            <p className="text-title-1">내 여행</p>
            <p className="text-title-2">2일차 · 10.25 (토)</p>
            <p className="text-body-1">이치란 라멘 신주쿠점</p>
            <p className="text-body-2">진한 돈코츠 국물, 점심 웨이팅 30분 정도예요.</p>
            <p className="text-caption text-fg-muted">신주쿠구 신주쿠 3-34-11 · 직선 650m</p>
            <p className="tabular text-micro text-fg-sub">D-3 · 09:00 · 12:30</p>
          </div>
        </Section>

        <Section title="버튼">
          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth>
              일정에 추가
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button>길찾기</Button>
              <Button variant="secondary">상세 보기</Button>
              <Button variant="ghost">기본값으로 되돌리기</Button>
              <Button variant="danger">여행 삭제</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" leading={<Copy aria-hidden="true" className="size-4" />}>
                예약번호 복사
              </Button>
              <Button size="sm" disabled>
                사용할 수 없음
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={loading}
                onClick={() => {
                  setLoading(true);
                  window.setTimeout(() => setLoading(false), 1500);
                }}
              >
                {loading ? '저장 중' : '눌러서 로딩 보기'}
              </Button>
            </div>
            <div className="flex gap-1">
              <IconButton label="저장" icon={<Heart />} />
              <IconButton label="지도에서 보기" icon={<MapPin />} />
              <IconButton label="숙소" icon={<Bed />} />
              <IconButton label="알림" icon={<Bell />} tone="tint" />
            </div>
          </div>
        </Section>

        <Section title="칩 (여러 개 선택)">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ['lodging', '🏨 숙소'],
                ['food', '🍜 맛집'],
                ['cafe', '☕ 카페'],
                ['sight', '🏯 관광'],
                ['shop', '🛍 쇼핑'],
              ] as const
            ).map(([id, label]) => (
              <Chip key={id} selected={categories.includes(id)} onClick={() => toggleCategory(id)}>
                {label}
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {['10.24', '10.25', '10.26'].map((d, i) => (
              <Chip
                key={d}
                selected={i === 1}
                leading={<span className={`size-2 rounded-full bg-day-${i + 1}`} />}
              >
                {i + 1}일차 {d}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="세그먼트 (2~4개 중 하나)">
          <SegmentedControl
            label="시간 표기"
            value={timeFormat}
            onChange={setTimeFormat}
            options={[
              { value: '24h', label: '24시간 09:00' },
              { value: '12h', label: '오전 9:00' },
            ]}
          />
        </Section>

        <Section title="라디오 목록 (5개 이상 / 설명 필요)">
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <RadioList
              label="기본 길찾기 앱"
              value={mapApp}
              onChange={setMapApp}
              options={[
                { value: 'naver', label: '네이버 지도', icon: <AppMark bg="#03C75A">N</AppMark> },
                { value: 'google', label: 'Google 지도', icon: <AppMark bg="#4285F4">G</AppMark> },
                {
                  value: 'kakao',
                  label: '카카오맵',
                  icon: (
                    <AppMark bg="#FEE500" dark>
                      K
                    </AppMark>
                  ),
                },
                {
                  value: 'ask',
                  label: '매번 묻기',
                  description: '길찾기를 누를 때마다 앱을 골라요',
                  icon: <AppMark bg="#8B95A1">?</AppMark>,
                },
              ]}
            />
          </div>
        </Section>

        <Section title="스위치 · 스테퍼 · 슬라이더">
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <label htmlFor="dev-haptics" className="text-body-2 font-medium">
                진동
              </label>
              <Switch id="dev-haptics" checked={haptics} onCheckedChange={setHaptics} />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="text-body-2 font-medium">백업 알림 주기</span>
              <Stepper
                label="백업 알림 주기"
                value={backupDays}
                onChange={setBackupDays}
                min={0}
                max={56}
                step={7}
                format={(v) => (v === 0 ? '끄기' : `${v}일`)}
              />
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <div className="flex justify-between text-body-2 font-medium">
                <span>글자 크기</span>
                <span className="text-primary">{fontNames[fontStep]}</span>
              </div>
              <Slider
                label="글자 크기"
                value={fontStep}
                onChange={setFontStep}
                min={0}
                max={3}
                showTicks
              />
              <p
                className="rounded-lg bg-bg-subtle px-3 py-2 text-fg-sub"
                style={{ fontSize: `${15 * (fontScales[fontStep] ?? 1)}px` }}
              >
                2일차 · 센소지 09:00
              </p>
            </div>
            <div className="flex flex-col gap-1 px-4 py-3">
              <div className="flex justify-between text-body-2 font-medium">
                <span>기본 검색 반경</span>
                <span className="tabular text-primary">{radius}km</span>
              </div>
              <Slider
                label="기본 검색 반경"
                value={radius}
                onChange={setRadius}
                min={0.5}
                max={20}
                step={0.5}
              />
            </div>
          </div>
        </Section>

        <Section title="시트 · 알림">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              바텀시트 열기
            </Button>
            <Button variant="secondary" onClick={() => toast('예약번호를 복사했어요')}>
              토스트
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                snackbar('일정을 삭제했어요', {
                  label: '실행 취소',
                  onAction: () => toast('되돌렸어요'),
                })
              }
            >
              실행 취소 스낵바
            </Button>
          </div>
        </Section>
      </div>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="일정 추가"
        description="바깥을 누르거나 ESC로 닫을 수 있어요"
        footer={
          <Button
            size="lg"
            fullWidth
            onClick={() => {
              setSheetOpen(false);
              toast('일정을 추가했어요');
            }}
          >
            일정에 추가
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-semibold text-fg-sub">이름</span>
            <input
              className="h-12 rounded-btn border border-line bg-bg-subtle px-3 text-body-1 outline-none focus:border-primary"
              placeholder="예: 센소지"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto">
            {['관광', '맛집', '카페', '쇼핑', '이동', '메모'].map((k, i) => (
              <Chip key={k} selected={i === 0}>
                {k}
              </Chip>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-caption font-bold tracking-wide text-fg-muted">{title}</h2>
        {hint && <p className="text-caption text-fg-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`h-10 rounded-lg border border-line ${className}`} />
      <span className="truncate text-micro text-fg-muted">{name}</span>
    </div>
  );
}

function AppMark({
  bg,
  dark = false,
  children,
}: {
  bg: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className="grid size-7 place-items-center rounded-lg text-caption font-extrabold"
      style={{ background: bg, color: dark ? '#191F28' : '#FFFFFF' }}
    >
      {children}
    </span>
  );
}
