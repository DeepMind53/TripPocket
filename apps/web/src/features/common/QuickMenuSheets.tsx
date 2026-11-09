import {
  Copy,
  ChevronDown,
  ChevronRight,
  Pencil,
  Languages,
  Siren,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { dayNumberOf, getTripStatus, todayIn, type Trip } from '@trippocket/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { Link, useNavigate, useParams } from 'react-router';
import { useTrip, useTripBookings, useTrips } from '../../data/hooks';
import { EmergencySheet } from './EmergencySheet';
import { LocalInfoSection } from './LocalInfoSection';
import { lodgingForNight } from '../../domain/lodging';
import { copyText } from '../../shared/lib/clipboard';
import type { Destination } from '../../shared/lib/directions';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { timeIn, useMinuteClock } from '../../shared/hooks/useMinuteClock';
import { formatMonthDay } from '../../shared/lib/dateFormat';
import { updateSettings, useSettings } from '../../data/settingsStore';
import { BottomSheet, SegmentedControl, toast } from '../../shared/ui';
import { DirectionsSheet } from './DirectionsSheet';
import { CarCard } from './CarCard';
import { TravelLegCard } from './TravelLegCard';
import { travelLegsAhead, type TravelLeg } from '../../domain/travelLeg';
import { nowTimeIn } from '../../domain/lodging';
import { SavedSpotsButtons } from './SavedSpotsButtons';
import { ShortcutEditSheet } from './ShortcutEditSheet';
import { TabQuickInfo } from './TabQuickInfo';
import { TravelModeButton } from '../travel/TravelModeButton';
import {
  SHORTCUT_ICON,
  SHORTCUT_LAB,
  shortcutPath,
  useQuickShortcuts,
  type ShortcutId,
} from './quickShortcuts';
import { useLabs } from '../../data/labsStore';
import { openDirectionsDirect } from './openDirections';
import { isDomesticTrip } from '../../domain/tripPlace';

/**
 * 빠른 메뉴 시트들 (docs/12 §1) — ⚡ 버튼(QuickMenu.tsx)을 처음 누를 때 불러온다 (첫 화면 크기).
 * 여행 안에서는 바로가기 4개가 실제로 동작한다
 */
export function QuickMenuSheets({
  inTrip,
  open,
  setOpen,
}: {
  inTrip: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const trips = useTrips();
  const [sosOpen, setSosOpen] = useRouteSheet('quick-emergency');
  if (inTrip) return <TripQuickMenu open={open} setOpen={setOpen} />;
  // 여행 밖: 진행 중이거나 가장 가까운 다가오는 여행의 나라
  const soon = (trips ?? [])
    .filter((tr) => getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone)) !== 'past')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t('quickMenu.title')}
        headerAside={open ? <TravelModeButton tripId={soon?.id} replace /> : undefined}
      >
        <QuickMenuContent onEmergency={() => setSosOpen(true)} />
      </BottomSheet>
      <EmergencySheet open={sosOpen} onOpenChange={setSosOpen} countries={tripCountries(soon)} />
    </>
  );
}

/** 여행 목적지 나라 코드 (중복 없이, 적힌 순서) */
function tripCountries(trip: Trip | null | undefined): string[] {
  return [
    ...new Set(
      (trip?.destinations ?? []).map((d) => d.countryCode).filter((c): c is string => !!c),
    ),
  ];
}

/**
 * 여행 안의 빠른 메뉴: 바로가기 4개가 실제로 동작한다.
 * 길찾기·예약번호 시트는 메뉴 시트 밖에 두어, 메뉴가 닫혀도 열리고 뒤로가기로 메뉴에 돌아온다.
 */
function TripQuickMenu({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const bookings = useTripBookings(tripId) ?? [];
  const [dirOpen, setDirOpen] = useRouteSheet('quick-directions');
  const [numbersOpen, setNumbersOpen] = useRouteSheet('quick-booking-numbers');
  const [sosOpen, setSosOpen] = useRouteSheet('quick-emergency');
  const [dest, setDest] = useState<Destination | null>(null);
  const [carOpen, setCarOpen] = useState(false);

  const today = trip ? todayIn(trip.timezone) : '';
  const withNo = bookings.filter((b) => b.confirmationNo);
  // 렌터카: 오늘 쓰는 차 → 아직 반납 전인 차 → 첫 차 (사용자 요청 2026-11-02)
  // 지금 필요한 이동 정보 (여행지 시각 기준, 1분마다 다시 계산)
  const clock = useMinuteClock(open);
  // 이동수단을 출발 순서대로 — 지금 것과 다음 것 (기차·버스 포함, 2026-11-03)
  const legs = trip ? travelLegsAhead(bookings, today, nowTimeIn(trip.timezone, clock)) : [];
  const leg = legs[0] ?? null;
  const nextLeg = legs[1];
  const cars = bookings.filter((b) => b.kind === 'car' && !b.deletedAt);
  const car =
    (leg?.kind === 'car' ? leg.booking : undefined) ??
    cars.find((b) => b.start.date <= today && (b.end?.date ?? b.start.date) >= today) ??
    cars.find((b) => (b.end?.date ?? b.start.date) >= today) ??
    cars[0];

  const shortcuts: Shortcuts = {
    lodging: () => {
      const tonight = trip ? lodgingForNight(bookings, today)?.booking : undefined;
      const lodging = tonight ?? bookings.find((b) => b.kind === 'lodging');
      if (!lodging) {
        toast(t('quickMenu.noLodging'));
        return;
      }
      const d = { name: lodging.title, address: lodging.details?.address };
      if (openDirectionsDirect(d, trip ? isDomesticTrip(trip) : undefined)) return;
      setDest(d);
      setDirOpen(true);
    },
    bookingNo: () => {
      if (withNo.length === 0) toast(t('quickMenu.noBookingNo'));
      else setNumbersOpen(true);
    },
    nextItem: () => {
      const day = trip ? (dayNumberOf(trip.startDate, trip.endDate, today) ?? 1) : 1;
      // 메뉴 기록 자리를 일정 화면으로 바꿔서, 뒤로 가면 원래 화면
      void navigate(`/trips/${tripId}/plan?day=${day}`, { replace: true });
    },
    checklist: () => void navigate(`/trips/${tripId}/checklist`, { replace: true }),
    ...(car ? { car: () => setCarOpen(true) } : {}),
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t('quickMenu.title')}
        // 여행지 현지 날짜·시각 (일정 제목 아래에서는 가려 보이지 않아 여기로, 사용자 요청 2026-10-27)
        // 여행 모드 켜기는 제목 바로 오른쪽에 작게 (사용자 요청 2026-11-04)
        headerAside={
          trip && open ? (
            <span className="flex items-center gap-2">
              <TravelModeButton tripId={trip.id} replace />
              <LocalNow timezone={trip.timezone} />
            </span>
          ) : undefined
        }
      >
        <QuickMenuContent
          shortcuts={shortcuts}
          trip={trip ?? undefined}
          leg={leg}
          nextLeg={nextLeg}
          onEmergency={() => setSosOpen(true)}
        />
      </BottomSheet>
      <CarCard car={car} open={carOpen} onClose={() => setCarOpen(false)} />
      <EmergencySheet open={sosOpen} onOpenChange={setSosOpen} countries={tripCountries(trip)} />
      <DirectionsSheet
        open={dirOpen}
        onOpenChange={setDirOpen}
        destination={dest}
        isDomestic={trip ? isDomesticTrip(trip) : false}
      />
      <BottomSheet
        open={numbersOpen}
        onOpenChange={setNumbersOpen}
        title={t('quickMenu.bookingNumbers')}
      >
        <ul className="flex flex-col divide-y divide-line">
          {withNo.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => void copyText(b.confirmationNo as string, t('bookings.copied'))}
                className="flex min-h-14 w-full items-center gap-3 text-left"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-2 font-medium">{b.title}</span>
                  <span className="text-caption text-fg-muted">{t(`bookingKind.${b.kind}`)}</span>
                </span>
                <span className="tabular text-body-1 font-bold">{b.confirmationNo}</span>
                <Copy aria-hidden="true" className="size-4 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

interface Shortcuts {
  lodging: () => void;
  bookingNo: () => void;
  nextItem: () => void;
  checklist: () => void;
  /** 렌터카 예약이 있을 때만 */
  car?: () => void;
}

function QuickMenuContent({
  shortcuts,
  trip,
  leg,
  nextLeg,
  onEmergency,
}: {
  shortcuts?: Shortcuts;
  trip?: Trip | undefined;
  leg?: TravelLeg | undefined;
  nextLeg?: NonNullable<TravelLeg> | undefined;
  onEmergency: () => void;
}) {
  const inTrip = shortcuts !== undefined;
  const { tripId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ids = useQuickShortcuts((st) => st.ids);
  const labs = useLabs();
  // 실험을 끈 기능의 바로가기는 숨긴다
  const chosen = ids.filter((id) => {
    const lab = SHORTCUT_LAB[id];
    return !lab || labs[lab] === true;
  });
  const runShortcut = (id: ShortcutId) => {
    const own = shortcuts?.[id as keyof Shortcuts];
    if (own) return own();
    if (id === 'car') return toast(t('quickMenu.noCar'));
    const path = shortcutPath(id, tripId ?? '');
    // 메뉴 기록 자리를 그 화면으로 바꿔서, 뒤로 가면 원래 화면
    if (path) void navigate(path, { replace: true });
  };
  const theme = useSettings((st) => st.theme);
  const app = useSettings((st) => st.directionsApp);
  const mode = useSettings((st) => st.travelMode);

  return (
    <div className="flex flex-col gap-5">
      {/* 자주 쓰는 4개를 2×2로 (사용자 요청 2026-10-27) — 긴급 연락처는 급할 때 찾기 쉽게 왼쪽 위 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onEmergency}
          className="flex min-h-20 flex-col justify-center gap-0.5 rounded-card border border-danger/40 px-3 py-2.5 text-left"
        >
          {/* 제목은 아이콘 오른쪽, 설명은 아래 (사용자 요청 2026-11-04) */}
          <span className="flex items-center gap-1.5">
            <Siren aria-hidden="true" className="size-5 shrink-0 text-danger" />
            <span className="text-body-2 font-semibold">{t('emergency.title')}</span>
          </span>
          <span className="text-micro text-fg-muted">{t('emergency.menuDesc')}</span>
        </button>
        <Link
          to={tripId ? `/fx?trip=${tripId}` : '/fx'}
          className="flex min-h-20 flex-col justify-center gap-0.5 rounded-card bg-bg-subtle px-3 py-2.5 text-left"
        >
          {/* 제목은 아이콘 오른쪽, 설명은 아래 (사용자 요청 2026-11-04) */}
          <span className="flex items-center gap-1.5">
            <Wallet aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="text-body-2 font-semibold">{t('quickMenu.fx')}</span>
          </span>
          <span className="text-micro text-fg-muted">{t('quickMenu.fxDesc')}</span>
        </Link>
        <Link
          to={tripId ? `/ai?trip=${tripId}` : '/ai'}
          className="flex min-h-20 flex-col justify-center gap-0.5 rounded-card bg-primary-weak px-3 py-2.5 text-left"
        >
          {/* 제목은 아이콘 오른쪽, 설명은 아래 (사용자 요청 2026-11-04) */}
          <span className="flex items-center gap-1.5">
            <Sparkles aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="text-body-2 font-semibold">{t('quickMenu.ai')}</span>
          </span>
          <span className="text-micro text-fg-muted">{t('quickMenu.aiDesc')}</span>
        </Link>
        {/* 번역·회화 (docs/20 G7) */}
        <Link
          to={tripId ? `/phrases?trip=${tripId}` : '/phrases'}
          className="flex min-h-20 flex-col justify-center gap-0.5 rounded-card bg-bg-subtle px-3 py-2.5 text-left"
        >
          {/* 제목은 아이콘 오른쪽, 설명은 아래 (사용자 요청 2026-11-04) */}
          <span className="flex items-center gap-1.5">
            <Languages aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="text-body-2 font-semibold">{t('quickMenu.phrases')}</span>
          </span>
          <span className="text-micro text-fg-muted">{t('quickMenu.phrasesDesc')}</span>
        </Link>
      </div>

      {/* 바로가기 위: 지금 이동 정보(출국편 → 렌터카 반납 전까지 → 귀국편) + 위치 저장 2개 (사용자 요청 2026-11-03) */}
      {trip && (leg || shortcuts) && (
        <section className="flex flex-col gap-2">
          {leg && (
            <TravelLegCard
              leg={leg}
              next={nextLeg}
              tripId={trip.id}
              onCar={() => shortcuts?.car?.()}
            />
          )}
          {shortcuts && <SavedSpotsButtons trip={trip} horizontal />}
        </section>
      )}
      {/* 여행 밖: 탭마다 맞는 정보 + 바로가기 (사용자 요청 2026-11-03) */}
      {!inTrip && <TabQuickInfo />}
      {/* 바로가기 4칸: 편집으로 모든 기능·화면 중에서 고른다 (사용자 요청 2026-11-02) — 여행 안에서만 */}
      {inTrip && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-caption font-bold text-fg-muted">{t('quickMenu.shortcuts')}</h3>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex h-9 items-center gap-1 text-caption font-semibold text-primary"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
              {t('quickMenu.edit')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {chosen.map((id) => {
              const Icon = SHORTCUT_ICON[id];
              return (
                <Shortcut
                  key={id}
                  icon={<Icon />}
                  label={t(`quickMenu.shortcut.${id}`)}
                  onClick={() => runShortcut(id)}
                />
              );
            })}
          </div>
        </section>
      )}
      <ShortcutEditSheet open={editOpen} onOpenChange={setEditOpen} />

      {/* 실험실: 교통카드·결제 팁·바우처 */}
      {inTrip && tripId && <LocalInfoSection tripId={tripId} />}

      {/* 빠른 설정은 기본으로 접어 둔다 (사용자 요청 2026-11-02) */}
      <section className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="flex h-10 items-center justify-between text-caption font-bold text-fg-muted"
        >
          {t('quickMenu.quickSettings')}
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {settingsOpen && (
          <>
            <span className="text-caption font-semibold text-fg-sub">{t('quickMenu.theme')}</span>
            <SegmentedControl
              label={t('quickMenu.theme')}
              value={theme}
              onChange={(v) => updateSettings({ theme: v })}
              options={[
                { value: 'light', label: t('quickMenu.themeLight') },
                { value: 'dark', label: t('quickMenu.themeDark') },
                { value: 'system', label: t('quickMenu.themeSystem') },
              ]}
            />
            <span className="mt-1 text-caption font-semibold text-fg-sub">
              {t('settings.directionsApp')}
            </span>
            <SegmentedControl
              label={t('settings.directionsApp')}
              value={app}
              onChange={(v) => updateSettings({ directionsApp: v })}
              options={[
                { value: 'naver', label: t('quickMenu.appNaver') },
                { value: 'kakao', label: t('quickMenu.appKakao') },
                { value: 'ask', label: t('quickMenu.appAsk') },
              ]}
            />
            <span className="mt-1 text-caption font-semibold text-fg-sub">
              {t('settings.travelMode')}
            </span>
            <SegmentedControl
              label={t('settings.travelMode')}
              value={mode}
              onChange={(v) => updateSettings({ travelMode: v })}
              options={[
                { value: 'transit', label: t('dir.transit') },
                { value: 'walk', label: t('dir.walk') },
                { value: 'car', label: t('dir.car') },
              ]}
            />
          </>
        )}
      </section>

      <Link
        to="/settings"
        className="flex h-12 items-center justify-between border-t border-line pt-1 text-body-2 font-semibold"
      >
        <span className="flex items-center gap-2">
          <Settings aria-hidden="true" className="size-[18px] text-fg-sub" />
          {t('quickMenu.allSettings')}
        </span>
        <ChevronRight aria-hidden="true" className="size-5 text-fg-muted" />
      </Link>
    </div>
  );
}

function Shortcut({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 items-center gap-2 rounded-btn bg-bg-subtle px-3 text-caption font-semibold"
    >
      <span aria-hidden="true" className="text-primary [&>svg]:size-[18px]">
        {icon}
      </span>
      {label}
    </button>
  );
}

/** 빠른 메뉴 제목 오른쪽: 여행지 현지 날짜·시각 (1분마다) */
function LocalNow({ timezone }: { timezone: string }) {
  const { t } = useTranslation();
  const now = useMinuteClock(true);
  const time = timeIn(timezone, now);
  if (!time) return null;
  return (
    <span className="tabular text-caption text-fg-sub">
      {t('quickMenu.localNow', { date: formatMonthDay(todayIn(timezone, now)), time })}
    </span>
  );
}
