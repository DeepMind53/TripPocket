import {
  Bed,
  CalendarClock,
  ChevronRight,
  ListChecks,
  Settings,
  Sparkles,
  Ticket,
  Wallet,
  Zap,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { applyTheme, type ThemePref } from '../../shared/lib/theme';
import { BottomSheet, IconButton, SegmentedControl, toast } from '../../shared/ui';

const SHEET_KEY = 'quick-menu';

/** 헤더의 ⚡ 버튼 + 빠른 메뉴 시트 (docs/12 §1). 앱 홈·여행 상세 헤더 같은 위치에 둔다. */
export function QuickMenuButton({ inTrip = false }: { inTrip?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useRouteSheet(SHEET_KEY);
  return (
    <>
      <IconButton
        label={t('quickMenu.title')}
        icon={<Zap />}
        tone="tint"
        onClick={() => setOpen(true)}
      />
      <BottomSheet open={open} onOpenChange={setOpen} title={t('quickMenu.title')}>
        <QuickMenuContent inTrip={inTrip} />
      </BottomSheet>
    </>
  );
}

function QuickMenuContent({ inTrip }: { inTrip: boolean }) {
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

      {inTrip && (
        <section className="flex flex-col gap-2">
          <h3 className="text-caption font-bold text-fg-muted">{t('quickMenu.shortcuts')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <Shortcut icon={<Bed />} label={t('quickMenu.shortcut.lodging')} step={8} />
            <Shortcut icon={<Ticket />} label={t('quickMenu.shortcut.bookingNo')} step={8} />
            <Shortcut icon={<CalendarClock />} label={t('quickMenu.shortcut.nextItem')} step={8} />
            <Shortcut icon={<ListChecks />} label={t('quickMenu.shortcut.checklist')} step={9} />
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

function Shortcut({ icon, label, step }: { icon: ReactNode; label: string; step: number }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => toast(t('common.comingInStep', { step }))}
      className="flex h-12 items-center gap-2 rounded-btn bg-bg-subtle px-3 text-caption font-semibold"
    >
      <span aria-hidden="true" className="text-primary [&>svg]:size-[18px]">
        {icon}
      </span>
      {label}
    </button>
  );
}
