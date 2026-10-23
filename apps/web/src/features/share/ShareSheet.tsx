import type { Trip } from '@trippocket/shared';
import { Copy, FileDown, Image, Link2, Link2Off, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { inviteUrl, shareApi, shareUrl, type Member, type ShareLink } from '../../data/api/share';
import { useAuth } from '../../data/authStore';
import { bookingRepo } from '../../data/repositories/bookingRepo';
import { itemRepo } from '../../data/repositories/itemRepo';
import { backupFileName, createTripBackup } from '../../data/services/backupService';
import { tripToText } from '../../domain/shareText';
import { useTranslation } from '../../i18n';
import { useTimeText } from '../../shared/hooks/useTimeText';
import { copyText } from '../../shared/lib/clipboard';
import { textToImage } from '../../shared/lib/textImage';
import { BottomSheet, Button, SegmentedControl, Switch, toast } from '../../shared/ui';
import { saveFile } from '../backup/backupUtils';

/**
 * S-25 공유·내보내기. 서버 없이: 텍스트·이미지·파일. 로그인하면: 보기 전용 링크·초대·멤버 (S-24)
 */
export function ShareSheet({
  trip,
  open,
  onOpenChange,
}: {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { time } = useTimeText();
  const loggedIn = useAuth((s) => s.status === 'user');
  const [link, setLink] = useState<ShareLink | null>(null);
  const [sensitive, setSensitive] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [busy, setBusy] = useState(false);
  const myRole = members?.find((m) => m.me)?.role;

  useEffect(() => {
    if (!open || !loggedIn) return;
    void shareApi.get(trip.id).then((r) => setLink(r.ok ? r.data.share : null));
    void shareApi.members(trip.id).then((r) => setMembers(r.ok ? r.data.members : null));
  }, [open, loggedIn, trip.id]);

  // 누른 순간 기기 DB에서 읽는다 (화면이 아직 불러오는 중이어도 빈 일정이 복사되지 않게)
  const text = async () =>
    tripToText(
      trip,
      await itemRepo.listByTrip(trip.id),
      await bookingRepo.listByTrip(trip.id),
      time,
    );
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      toast(t('share.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t('share.title')}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-2">
          <Tile
            icon={<Copy />}
            label={t('share.text')}
            onClick={() => void text().then((x) => copyText(x, t('share.textCopied')))}
          />
          <Tile
            icon={<Image />}
            label={t('share.image')}
            onClick={() =>
              void run(async () => {
                const blob = await textToImage((await text()).split('\n'));
                await saveFile(`${trip.title}.png`, blob, trip.title, 'image/png');
              })
            }
          />
          <Tile
            icon={<FileDown />}
            label={t('share.file')}
            onClick={() =>
              void run(async () => {
                const file = await createTripBackup(trip.id);
                await saveFile(
                  backupFileName(file).replace('backup', 'trip'),
                  JSON.stringify(file),
                  trip.title,
                );
              })
            }
          />
        </div>

        <section className="flex flex-col gap-3 rounded-card border border-line p-4">
          <h3 className="flex items-center gap-2 text-body-1 font-bold">
            <Link2 aria-hidden="true" className="size-5 text-primary" />
            {t('share.link')}
          </h3>
          {!loggedIn ? (
            <>
              <p className="text-caption text-fg-muted">{t('share.needLogin')}</p>
              <Button
                variant="secondary"
                onClick={() =>
                  void navigate(`/login?returnTo=${encodeURIComponent(`/trips/${trip.id}/plan`)}`)
                }
              >
                {t('me.login')}
              </Button>
            </>
          ) : link ? (
            <>
              <p className="text-caption text-fg-sub">
                {link.includeSensitive ? t('share.linkWithSensitive') : t('share.linkSafe')}
              </p>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => void copyText(shareUrl(link.id), t('share.linkCopied'))}
                >
                  {t('share.copyLink')}
                </Button>
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() =>
                    void run(async () => {
                      if ((await shareApi.revoke(trip.id)).ok) {
                        setLink(null);
                        toast(t('share.linkOff'));
                      }
                    })
                  }
                >
                  <Link2Off aria-hidden="true" className="size-4" />
                  {t('share.turnOff')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-2">{t('share.includeSensitive')}</span>
                <Switch
                  label={t('share.includeSensitive')}
                  checked={sensitive}
                  onCheckedChange={setSensitive}
                />
              </div>
              <Button
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await shareApi.create(trip.id, sensitive);
                    if (!r.ok) throw new Error(r.reason);
                    setLink(r.data.share);
                    await copyText(shareUrl(r.data.share.id), t('share.linkCopied'));
                  })
                }
              >
                {t('share.makeLink')}
              </Button>
            </>
          )}
        </section>

        {loggedIn && myRole === 'owner' && (
          <section className="flex flex-col gap-3 rounded-card border border-line p-4">
            <h3 className="flex items-center gap-2 text-body-1 font-bold">
              <UserPlus aria-hidden="true" className="size-5 text-primary" />
              {t('share.invite')}
            </h3>
            <SegmentedControl
              label={t('share.inviteRole')}
              value={inviteRole}
              onChange={setInviteRole}
              options={[
                { value: 'editor', label: t('share.role.editor') },
                { value: 'viewer', label: t('share.role.viewer') },
              ]}
            />
            <Button
              variant="secondary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  const r = await shareApi.invite(trip.id, inviteRole);
                  if (!r.ok) throw new Error(r.reason);
                  await copyText(inviteUrl(r.data.token), t('share.inviteCopied'));
                })
              }
            >
              {t('share.makeInvite')}
            </Button>
            <p className="text-caption text-fg-muted">{t('share.inviteNote')}</p>
          </section>
        )}

        {loggedIn && members && members.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-body-2 font-bold text-fg-sub">
              <Users aria-hidden="true" className="size-4" />
              {t('share.members', { n: members.length })}
            </h3>
            <ul className="flex flex-col divide-y divide-line">
              {members.map((m) => (
                <li key={m.userId} className="flex min-h-12 items-center gap-2">
                  <span className="flex-1 text-body-2">
                    {m.nickname}
                    {m.me && ` (${t('share.me')})`}
                  </span>
                  {myRole === 'owner' && m.role !== 'owner' ? (
                    <>
                      <SegmentedControl
                        label={t('share.inviteRole')}
                        value={m.role}
                        onChange={(role) =>
                          void shareApi.setRole(trip.id, m.userId, role).then((r) => {
                            if (r.ok)
                              setMembers((list) =>
                                (list ?? []).map((x) =>
                                  x.userId === m.userId ? { ...x, role } : x,
                                ),
                              );
                          })
                        }
                        options={[
                          { value: 'editor', label: t('share.role.editor') },
                          { value: 'viewer', label: t('share.role.viewer') },
                        ]}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void shareApi.remove(trip.id, m.userId).then((r) => {
                            if (r.ok)
                              setMembers((list) =>
                                (list ?? []).filter((x) => x.userId !== m.userId),
                              );
                          })
                        }
                      >
                        {t('share.removeMember')}
                      </Button>
                    </>
                  ) : (
                    <span className="text-caption text-fg-muted">{t(`share.role.${m.role}`)}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </BottomSheet>
  );
}

function Tile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-card bg-bg-subtle py-3 text-caption font-semibold"
    >
      <span aria-hidden="true" className="text-primary [&>svg]:size-6">
        {icon}
      </span>
      {label}
    </button>
  );
}
