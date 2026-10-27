import {
  Bed,
  Copy,
  CalendarClock,
  ChevronRight,
  Languages,
  Siren,
  ListChecks,
  Settings,
  Sparkles,
  Ticket,
  Wallet,
} from 'lucide-react';
import { dayNumberOf, getTripStatus, todayIn, type Trip } from '@trippocket/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { Link, useNavigate, useParams } from 'react-router';
import { useTrip, useTripBookings, useTrips } from '../../data/hooks';
import { EmergencySheet } from './EmergencySheet';
import { lodgingForNight } from '../../domain/lodging';
import { copyText } from '../../shared/lib/clipboard';
import type { Destination } from '../../shared/lib/directions';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { updateSettings, useSettings } from '../../data/settingsStore';
import { BottomSheet, SegmentedControl, toast } from '../../shared/ui';
import { DirectionsSheet } from './DirectionsSheet';
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
      <BottomSheet open={open} onOpenChange={setOpen} title={t('quickMenu.title')}>
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

  const today = trip ? todayIn(trip.timezone) : '';
  const withNo = bookings.filter((b) => b.confirmationNo);

  const shortcuts: Shortcuts = {
    lodging: () => {
      const tonight = trip ? lodgingForNight(bookings, today)?.booking : undefined;
      const lodging = tonight ?? bookings.find((b) => b.kind === 'lodging');
      if (!lodging) {
        toast(t('quickMenu.noLodging'));
        return;
      }
      const d = { name: lodging.title, address: lodging.details?.address };
      if (openDirectionsDirect(d)) return;
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
  };

  return (
    <>
      <BottomSheet open={open} onOpenChange={setOpen} title={t('quickMenu.title')}>
        <QuickMenuContent shortcuts={shortcuts} onEmergency={() => setSosOpen(true)} />
      </BottomSheet>
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
}

function QuickMenuContent({
  shortcuts,
  onEmergency,
}: {
  shortcuts?: Shortcuts;
  onEmergency: () => void;
}) {
  const inTrip = shortcuts !== undefined;
  const { tripId } = useParams();
  const { t } = useTranslation();
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
          <Siren aria-hidden="true" className="size-5 text-danger" />
          <span className="text-body-2 font-semibold">{t('emergency.title')}</span>
          <span className="text-micro text-fg-muted">{t('emergency.menuDesc')}</span>
        </button>
        <Link
          to={tripId ? `/fx?trip=${tripId}` : '/fx'}
          className="flex min-h-20 flex-col justify-center gap-0.5 rounded-card bg-bg-subtle px-3 py-2.5 text-left"
        >
          <Wallet aria-hidden="true" className="size-5 text-primary" />
          <span className="text-body-2 font-semibold">{t('quickMenu.fx')}</span>
          <span className="text-micro text-fg-muted">{t('quickMenu.fxDesc')}</span>
        </Link>
        <Link
          to={tripId ? `/ai?trip=${tripId}` : '/ai'}
          className="flex min-h-20 flex-col justify-center gap-0.5 rounded-card bg-primary-weak px-3 py-2.5 text-left"
        >
          <Sparkles aria-hidden="true" className="size-5 text-primary" />
          <span className="text-body-2 font-semibold">{t('quickMenu.ai')}</span>
          <span className="text-micro text-fg-muted">{t('quickMenu.aiDesc')}</span>
        </Link>
        {/* 번역·회화 (docs/20 G7) */}
        <Link
          to={tripId ? `/phrases?trip=${tripId}` : '/phrases'}
          className="flex min-h-20 flex-col justify-center gap-0.5 rounded-card bg-bg-subtle px-3 py-2.5 text-left"
        >
          <Languages aria-hidden="true" className="size-5 text-primary" />
          <span className="text-body-2 font-semibold">{t('quickMenu.phrases')}</span>
          <span className="text-micro text-fg-muted">{t('quickMenu.phrasesDesc')}</span>
        </Link>
      </div>

      {inTrip && shortcuts && (
        <section className="flex flex-col gap-2">
          <h3 className="text-caption font-bold text-fg-muted">{t('quickMenu.shortcuts')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <Shortcut
              icon={<Bed />}
              label={t('quickMenu.shortcut.lodging')}
              onClick={shortcuts.lodging}
            />
            <Shortcut
              icon={<Ticket />}
              label={t('quickMenu.shortcut.bookingNo')}
              onClick={shortcuts.bookingNo}
            />
            <Shortcut
              icon={<CalendarClock />}
              label={t('quickMenu.shortcut.nextItem')}
              onClick={shortcuts.nextItem}
            />
            <Shortcut
              icon={<ListChecks />}
              label={t('quickMenu.shortcut.checklist')}
              onClick={shortcuts.checklist}
            />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-caption font-bold text-fg-muted">{t('quickMenu.quickSettings')}</h3>
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
