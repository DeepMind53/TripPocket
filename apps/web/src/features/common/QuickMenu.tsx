import {
  Bed,
  Copy,
  CalendarClock,
  ChevronRight,
  ListChecks,
  Settings,
  Sparkles,
  Ticket,
  Wallet,
  Zap,
} from 'lucide-react';
import { dayNumberOf, todayIn } from '@trippocket/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { Link, useNavigate, useParams } from 'react-router';
import { useTrip, useTripBookings } from '../../data/hooks';
import { lodgingForNight } from '../../domain/lodging';
import { copyText } from '../../shared/lib/clipboard';
import type { Destination } from '../../shared/lib/directions';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { applyTheme, type ThemePref } from '../../shared/lib/theme';
import { BottomSheet, IconButton, SegmentedControl, toast } from '../../shared/ui';
import { DirectionsSheet } from './DirectionsSheet';

const SHEET_KEY = 'quick-menu';

/** 헤더의 ⚡ 버튼 + 빠른 메뉴 시트 (docs/12 §1). 앱 홈·여행 상세 헤더 같은 위치에 둔다. */
export function QuickMenuButton({ inTrip = false }: { inTrip?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useRouteSheet(SHEET_KEY);
  if (inTrip) return <TripQuickMenu open={open} setOpen={setOpen} />;
  return (
    <>
      <IconButton
        label={t('quickMenu.title')}
        icon={<Zap />}
        tone="tint"
        onClick={() => setOpen(true)}
      />
      <BottomSheet open={open} onOpenChange={setOpen} title={t('quickMenu.title')}>
        <QuickMenuContent />
      </BottomSheet>
    </>
  );
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
      setDest({ name: lodging.title, address: lodging.details?.address });
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
  };

  return (
    <>
      <IconButton
        label={t('quickMenu.title')}
        icon={<Zap />}
        tone="tint"
        onClick={() => setOpen(true)}
      />
      <BottomSheet open={open} onOpenChange={setOpen} title={t('quickMenu.title')}>
        <QuickMenuContent shortcuts={shortcuts} />
      </BottomSheet>
      <DirectionsSheet
        open={dirOpen}
        onOpenChange={setDirOpen}
        destination={dest}
        isDomestic={trip?.timezone === 'Asia/Seoul'}
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
}

function QuickMenuContent({ shortcuts }: { shortcuts?: Shortcuts }) {
  const inTrip = shortcuts !== undefined;
  const { t } = useTranslation();
  // 10단계(설정)에서 저장소에 연결한다. 지금은 화면에서만 바뀐다.
  const [theme, setTheme] = useState<ThemePref>(
    (document.documentElement.dataset.theme as ThemePref | undefined) ?? 'system',
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <ToolCard
          icon={<Wallet />}
          title={t('quickMenu.fx')}
          desc={t('quickMenu.fxDesc')}
          step={19}
        />
        <ToolCard
          icon={<Sparkles />}
          title={t('quickMenu.ai')}
          desc={t('quickMenu.aiDesc')}
          step={20}
          accent
        />
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
              onClick={() => toast(t('common.comingInStep', { step: 9 }))}
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
          onChange={(v) => {
            setTheme(v);
            applyTheme(v);
          }}
          options={[
            { value: 'light', label: t('quickMenu.themeLight') },
            { value: 'dark', label: t('quickMenu.themeDark') },
            { value: 'system', label: t('quickMenu.themeSystem') },
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

function ToolCard({
  icon,
  title,
  desc,
  step,
  accent = false,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  step: number;
  accent?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => toast(t('common.comingInStep', { step }))}
      className={`flex items-center gap-3 rounded-card px-4 py-3 text-left ${accent ? 'bg-primary-weak' : 'bg-bg-subtle'}`}
    >
      <span aria-hidden="true" className="text-primary [&>svg]:size-5">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-1">{title}</span>
        <span className="text-caption text-fg-muted">{desc}</span>
      </span>
      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-micro text-fg-muted">
        {t('quickMenu.soon')}
      </span>
    </button>
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
