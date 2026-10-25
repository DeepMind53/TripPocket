import { LogOut, MonitorSmartphone, Pencil, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  deleteAccount,
  listSessions,
  logout,
  refreshMe,
  revokeSession,
  useAuth,
  type DeviceSession,
} from '../../data/authStore';
import { useSync } from '../../data/sync/syncStore';
import { ServerOfflineNotice } from '../common/ServerOfflineNotice';
import { useTranslation } from '../../i18n';
import { cn } from '../../shared/lib/cn';
import { useRouteSheet } from '../../shared/hooks/useRouteSheet';
import { BottomSheet, Button, IconButton, RadioList, toast } from '../../shared/ui';
import { NicknameSheet } from './NicknameSheet';
import { reviewsApi, type PointHistory } from '../../data/api/reviews';

/** 마이 위쪽 계정 칸: 로그인 전 = 안내·로그인 버튼, 로그인 후 = 닉네임·기기·로그아웃·탈퇴 */
export function AccountCard() {
  const { t } = useTranslation();
  const { status, me } = useAuth();
  const [sheet, setSheet] = useRouteSheet('account');
  const [nicknameOpen, setNicknameOpen] = useRouteSheet('nickname');
  const [kind, setKind] = useState<'devices' | 'logout' | 'delete' | 'points'>('devices');
  const [points, setPoints] = useState<PointHistory | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [wipe, setWipe] = useState<'keep' | 'wipe'>('keep');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'unknown') void refreshMe();
  }, [status]);

  const open = (k: typeof kind) => {
    setKind(k);
    if (k === 'devices') void listSessions().then(setSessions);
    if (k === 'points')
      void reviewsApi.points().then((r) => {
        if (!r.ok) return;
        setPoints(r.data);
        const cur = useAuth.getState().me;
        if (cur) useAuth.setState({ me: { ...cur, points: r.data.balance } });
      });
    setSheet(true);
  };

  if (status !== 'user' || !me)
    return (
      <section className="rounded-card bg-bg-subtle">
        <ServerOfflineNotice />
      </section>
    );

  return (
    <section className="flex flex-col gap-3 rounded-card bg-bg-subtle p-4">
      {/* 이름 왼쪽, 로그인 수단·동기화는 오른쪽 (사용자 요청 2026-10-25) */}
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {/* 후기 포인트는 닉네임 왼쪽 (사용자 요청 2026-10-25) — 누르면 적립 내역 */}
          <button
            type="button"
            onClick={() => open('points')}
            aria-label={t('points.label', { n: (me.points ?? 0).toLocaleString() })}
            className="tabular flex h-8 shrink-0 items-center rounded-full bg-primary-weak px-2.5 text-caption font-bold text-primary"
          >
            🅟 {(me.points ?? 0).toLocaleString()}P
          </button>
          <span className="truncate text-title-2">{me.nickname}</span>
          <IconButton
            label={t('nickname.change')}
            icon={<Pencil />}
            onClick={() => setNicknameOpen(true)}
          />
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 pt-1">
          <span className="text-caption text-fg-muted">
            {me.providers.map((p) => t(`login.name.${p}` as 'login.name.kakao')).join(' · ')}
          </span>
          <SyncStatus />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant="ghost" onClick={() => open('devices')}>
          <MonitorSmartphone aria-hidden="true" className="size-4" />
          {t('account.devices')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => open('logout')}>
          <LogOut aria-hidden="true" className="size-4" />
          {t('account.logout')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => open('delete')}>
          <UserX aria-hidden="true" className="size-4" />
          {t('account.delete')}
        </Button>
      </div>

      <BottomSheet
        open={sheet}
        onOpenChange={setSheet}
        title={t(`account.${kind}Title` as 'account.devicesTitle')}
        footer={
          kind === 'devices' || kind === 'points' ? undefined : (
            <Button
              size="lg"
              fullWidth
              loading={busy}
              variant={kind === 'delete' ? 'danger' : 'primary'}
              onClick={async () => {
                setBusy(true);
                try {
                  if (kind === 'logout') {
                    // 로그아웃하면 로그인 화면으로 바뀌므로(AuthGate) 시트를 먼저 닫는다
                    setSheet(false);
                    await logout(wipe === 'wipe');
                  } else if (!(await deleteAccount())) {
                    toast(t('account.failed'));
                    return;
                  }
                  setSheet(false);
                  toast(t(kind === 'logout' ? 'account.loggedOut' : 'account.deleted'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t(kind === 'logout' ? 'account.logout' : 'account.deleteConfirm')}
            </Button>
          )
        }
      >
        {kind === 'points' && (
          <div className="flex flex-col gap-2 pb-2">
            <p className="text-caption whitespace-pre-line text-fg-muted">{t('points.desc')}</p>
            {points && points.history.length === 0 && (
              <p className="py-3 text-center text-body-2 text-fg-muted">{t('points.empty')}</p>
            )}
            <ul className="flex flex-col divide-y divide-line">
              {(points?.history ?? []).map((h, i) => (
                <li key={i} className="flex items-center gap-2 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-2">
                      {t(`points.reason.${h.reason}` as 'points.reason.review', {
                        name: h.placeName ?? '',
                      })}
                    </span>
                    <span className="tabular text-caption text-fg-muted">
                      {h.createdAt.slice(0, 10).replaceAll('-', '.')}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'tabular shrink-0 text-body-2 font-bold',
                      h.delta > 0 ? 'text-primary' : 'text-fg-muted',
                    )}
                  >
                    {h.delta > 0 ? '+' : ''}
                    {h.delta}P
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {kind === 'devices' && (
          <ul className="flex flex-col divide-y divide-line">
            {(sessions ?? []).map((s) => (
              <li key={s.id} className="flex min-h-14 items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-2 font-medium">
                    {deviceName(s.userAgent)}
                  </span>
                  <span className="text-caption text-fg-muted">
                    {s.current ? t('account.thisDevice') : s.lastSeenAt.slice(0, 10)}
                  </span>
                </span>
                {!s.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void revokeSession(s.id).then((ok) => {
                        if (ok) setSessions((list) => (list ?? []).filter((x) => x.id !== s.id));
                      })
                    }
                  >
                    {t('account.revoke')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {kind === 'logout' && (
          <RadioList
            label={t('account.logoutTitle')}
            value={wipe}
            onChange={setWipe}
            options={[
              {
                value: 'keep',
                label: t('account.keepData'),
                description: t('account.keepDataDesc'),
              },
              {
                value: 'wipe',
                label: t('account.wipeData'),
                description: t('account.wipeDataDesc'),
              },
            ]}
          />
        )}
        {kind === 'delete' && <p className="text-body-2 text-fg-sub">{t('account.deleteDesc')}</p>}
      </BottomSheet>
      {nicknameOpen && <NicknameSheet open onOpenChange={setNicknameOpen} />}
    </section>
  );
}

/** 브라우저 정보 → "아이폰 · Safari" 정도로 */
function deviceName(ua: string): string {
  const os = /iPhone|iPad/.test(ua)
    ? 'iPhone'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac/.test(ua)
          ? 'Mac'
          : '';
  const browser = /SamsungBrowser/.test(ua)
    ? 'Samsung'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : '';
  return [os, browser].filter(Boolean).join(' · ') || ua.slice(0, 30) || '?';
}

/** 동기화 상태 한 줄: "동기화됨" / "올릴 변경 3개" / "서버에 연결할 수 없어요" */
function SyncStatus() {
  const { t } = useTranslation();
  const { state, pending } = useSync();
  const text =
    state === 'syncing'
      ? t('sync.syncing')
      : state === 'offline'
        ? t('sync.offline')
        : state === 'error'
          ? t('sync.error')
          : pending > 0
            ? t('sync.pending', { n: pending })
            : t('sync.done');
  return (
    <span role="status" className="flex items-center gap-1 text-caption text-fg-sub">
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          state === 'idle' && pending === 0
            ? 'bg-success'
            : state === 'syncing'
              ? 'bg-primary'
              : 'bg-warning',
        )}
      />
      {text}
      {(state === 'offline' || state === 'error') && (
        <button
          type="button"
          onClick={() => void import('../../data/sync/syncEngine').then((m) => m.syncNow())}
          className="ml-1 font-semibold text-primary"
        >
          {t('sync.retry')}
        </button>
      )}
    </span>
  );
}
