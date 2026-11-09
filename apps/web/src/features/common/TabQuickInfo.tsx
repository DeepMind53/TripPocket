import { dayNumberOf, diffDays, getTripStatus, todayIn, type Trip } from '@trippocket/shared';
import { ChevronRight } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../data/authStore';
import { useSavedPlaces, useSetting, useTrips } from '../../data/hooks';
import { LAST_BACKUP_KEY } from '../../data/repositories/backupMeta';
import { useTranslation } from '../../i18n';
import { formatPeriod } from '../../shared/lib/dateFormat';
import { SHORTCUT_ICON, shortcutPath, type ShortcutId } from './quickShortcuts';

type Tab = 'home' | 'records' | 'saved' | 'me';

/** 지금 보고 있는 하단 탭 (여행 목록도 홈, 도움말은 마이) */
// eslint-disable-next-line react-refresh/only-export-components -- 탭 판별 함수(시험에서도 씀), 개발 중 새로고침 방식에만 영향
export function tabOf(pathname: string): Tab {
  if (pathname.startsWith('/records')) return 'records';
  if (pathname.startsWith('/saved')) return 'saved';
  if (pathname.startsWith('/me') || pathname.startsWith('/help')) return 'me';
  return 'home';
}

/**
 * 여행 밖 빠른 메뉴의 "정보 + 바로가기 4칸" (사용자 요청 2026-11-03): 홈·기록·저장·마이 탭마다 그 탭에 맞는 것.
 * 여행 기능 바로가기는 진행 중이거나 가장 가까운 여행으로 간다
 */
export function TabQuickInfo() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tab = tabOf(useLocation().pathname);
  const trips = useTrips() ?? [];
  const saved = useSavedPlaces();
  const me = useAuth((s) => s.me);
  const backupAt = useSetting<string | null>(LAST_BACKUP_KEY, null);

  const status = (tr: Trip) => getTripStatus(tr.startDate, tr.endDate, todayIn(tr.timezone));
  const soon = trips
    .filter((tr) => status(tr) !== 'past')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const past = trips
    .filter((tr) => status(tr) === 'past')
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  const last = past[0];

  let info: { title: string; sub?: string; to?: string };
  let ids: ShortcutId[];
  let tripId = '';
  if (tab === 'home') {
    if (soon) {
      const today = todayIn(soon.timezone);
      const n = dayNumberOf(soon.startDate, soon.endDate, today);
      info = {
        title: soon.title,
        sub: n
          ? t('quickTab.during', { n })
          : t('quickTab.dDay', { n: diffDays(today, soon.startDate) }),
        to: `/trips/${soon.id}/plan`,
      };
      tripId = soon.id;
      ids = ['plan', 'bookings', 'checklist', 'weather'];
    } else {
      info = { title: t('quickTab.noTrip'), sub: t('quickTab.newTrip'), to: '/trips/new' };
      ids = ['records', 'saved', 'backup', 'help'];
    }
  } else if (tab === 'records') {
    info = last
      ? {
          title: t('quickTab.pastCount', { n: past.length }),
          sub: `${last.title} · ${formatPeriod(last.startDate, last.endDate)}`,
          to: `/trips/${last.id}/plan`,
        }
      : { title: t('quickTab.noPast') };
    tripId = last?.id ?? '';
    ids = [...(last ? (['plan'] as const) : []), 'reviews', 'backup', 'trash'];
  } else if (tab === 'saved') {
    info = {
      title: t('quickTab.savedCount', { n: saved?.length ?? 0 }),
      ...(soon ? { sub: t('quickTab.savedHint', { name: soon.title }) } : {}),
    };
    tripId = soon?.id ?? '';
    ids = [...(soon ? (['places'] as const) : []), 'reviews', 'records', 'help'];
  } else {
    info = {
      title: me ? t('quickTab.hello', { name: me.nickname }) : t('quickTab.me'),
      sub: backupAt
        ? t('quickTab.backupAt', { date: backupAt.slice(0, 10) })
        : t('quickTab.noBackup'),
      to: '/backup',
    };
    ids = ['profile', 'backup', 'labs', 'help'];
  }

  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-2 font-semibold">{info.title}</span>
        {info.sub && <span className="truncate text-caption text-fg-muted">{info.sub}</span>}
      </span>
      {info.to && <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />}
    </>
  );
  const box = 'flex min-h-14 items-center gap-2 rounded-card border border-line px-3 py-2';

  return (
    <section aria-label={t(`quickTab.title.${tab}`)} className="flex flex-col gap-2">
      <h3 className="text-caption font-semibold text-fg-muted">{t(`quickTab.title.${tab}`)}</h3>
      {info.to ? (
        <Link to={info.to} replace className={box}>
          {body}
        </Link>
      ) : (
        <div className={box}>{body}</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {ids.map((id) => {
          const Icon = SHORTCUT_ICON[id];
          const path = id === 'saved' ? '/saved' : shortcutPath(id, tripId);
          return (
            <button
              key={id}
              type="button"
              // 메뉴 기록 자리를 그 화면으로 바꿔서, 뒤로 가면 원래 화면
              onClick={() => path && void navigate(path, { replace: true })}
              className="flex h-12 items-center gap-2 rounded-btn bg-bg-subtle px-3 text-caption font-semibold"
            >
              <Icon aria-hidden="true" className="size-[18px] text-primary" />
              {t(`quickMenu.shortcut.${id}`)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
