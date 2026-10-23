import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { adminApi, type JoinRequest, type ManagedUser } from '../../data/api/admin';
import { useAuth } from '../../data/authStore';
import { useTranslation } from '../../i18n';
import { Button, EmptyState, Spinner, TopBar, toast } from '../../shared/ui';

type Data = { requests: JoinRequest[]; users: ManagedUser[] };

/** 사용자 관리 (관리자만): 가입 요청 승인·거절, 사용 중지·다시 허용 */
export function AdminUsersPage() {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => s.me?.isAdmin === true);
  const [data, setData] = useState<Data | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () => adminApi.list().then((res) => setData(res.ok ? res.data : null)),
    [],
  );
  useEffect(() => {
    if (isAdmin) void adminApi.list().then((res) => setData(res.ok ? res.data : null));
  }, [isAdmin]);

  async function act(key: string, run: () => ReturnType<typeof adminApi.approve>, done: string) {
    setBusy(key);
    const res = await run();
    setBusy(null);
    toast(res.ok ? done : t('admin.failed'));
    if (res.ok) await load();
  }

  const shell = (body: ReactNode) => (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('admin.title')} backTo="/me" />
      <div className="flex flex-col gap-6 px-5 pt-2">{body}</div>
    </div>
  );
  if (!isAdmin) return shell(<EmptyState emoji="🔒" title={t('admin.onlyAdmin')} />);
  if (data === undefined) return shell(<Spinner />);
  if (data === null) return shell(<p className="text-body-2 text-fg-sub">{t('admin.offline')}</p>);

  const pending = data.requests.filter((r) => r.status === 'pending');
  const rejected = data.requests.filter((r) => r.status === 'rejected');
  const provider = (p: string) => t(`login.name.${p}` as 'login.name.kakao');
  const date = (iso: string) => iso.slice(0, 10).replace(/-/g, '.');

  return shell(
    <>
      <p className="text-caption text-fg-muted">{t('admin.desc')}</p>
      <Section title={t('admin.pending', { n: pending.length })}>
        {pending.length === 0 ? (
          <Empty text={t('admin.noPending')} />
        ) : (
          pending.map((r) => (
            <Row
              key={r.id}
              name={r.nickname}
              sub={t('admin.requestedAt', {
                provider: provider(r.provider),
                date: date(r.requestedAt),
              })}
            >
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => void act(r.id, () => adminApi.reject(r.id), t('admin.rejected'))}
              >
                {t('admin.reject')}
              </Button>
              <Button
                size="sm"
                loading={busy === r.id}
                disabled={busy !== null}
                onClick={() => void act(r.id, () => adminApi.approve(r.id), t('admin.approved'))}
              >
                {t('admin.approve')}
              </Button>
            </Row>
          ))
        )}
      </Section>

      <Section title={t('admin.users', { n: data.users.length })}>
        {data.users.map((u) => (
          <Row
            key={u.id}
            name={u.nickname}
            sub={[
              u.providers.map(provider).join(' · '),
              u.isAdmin
                ? t('admin.adminBadge')
                : u.status === 'disabled'
                  ? t('admin.disabledBadge')
                  : u.lastSeenAt
                    ? t('admin.lastSeen', { date: date(u.lastSeenAt) })
                    : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            {!u.isAdmin &&
              (u.status === 'disabled' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === u.id}
                  disabled={busy !== null}
                  onClick={() => void act(u.id, () => adminApi.enable(u.id), t('admin.enabled'))}
                >
                  {t('admin.enable')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === u.id}
                  disabled={busy !== null}
                  onClick={() => void act(u.id, () => adminApi.disable(u.id), t('admin.disabled'))}
                >
                  {t('admin.disable')}
                </Button>
              ))}
          </Row>
        ))}
      </Section>

      {rejected.length > 0 && (
        <Section title={t('admin.rejectedList', { n: rejected.length })}>
          {rejected.map((r) => (
            <Row key={r.id} name={r.nickname} sub={provider(r.provider)}>
              <Button
                size="sm"
                variant="secondary"
                loading={busy === r.id}
                disabled={busy !== null}
                onClick={() => void act(r.id, () => adminApi.approve(r.id), t('admin.approved'))}
              >
                {t('admin.approve')}
              </Button>
            </Row>
          ))}
        </Section>
      )}
    </>,
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-caption font-bold text-fg-muted">{title}</h2>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
        {children}
      </ul>
    </section>
  );
}

function Row({ name, sub, children }: { name: string; sub: string; children?: ReactNode }) {
  return (
    <li className="flex min-h-14 items-center gap-2 bg-surface px-4 py-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-2 font-medium">{name}</span>
        {sub && <span className="truncate text-caption text-fg-muted">{sub}</span>}
      </span>
      {children}
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <li className="bg-surface px-4 py-4 text-body-2 text-fg-sub">{text}</li>;
}
