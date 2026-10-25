import { useEffect, useState } from 'react';
import { suggestionsApi, type Suggestion } from '../../data/api/suggestions';
import { useTranslation } from '../../i18n';
import { Button, Chip, toast, TopBar } from '../../shared/ui';
import { ServerOfflineNotice } from '../common/ServerOfflineNotice';

const date = (iso: string) => iso.slice(0, 10).replaceAll('-', '.');

/** 관리자 → 개선 제안: 읽음·완료 표시, 답장(제안한 사람에게 알림) */
export function AdminSuggestionsPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<Suggestion[] | null | 'offline'>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const load = () =>
    void suggestionsApi.adminList().then((r) => setList(r.ok ? r.data.suggestions : 'offline'));
  useEffect(load, []);

  const update = async (
    s: Suggestion,
    patch: { status?: Suggestion['status']; reply?: string },
  ) => {
    const r = await suggestionsApi.adminUpdate(s.id, patch);
    if (!r.ok) return toast(t('admin.failed'));
    if (patch.reply) toast(t('suggest.replied'));
    load();
  };

  return (
    <>
      <TopBar title={t('suggest.adminTitle')} backTo="/me" />
      <div className="flex flex-col gap-3 px-5 pt-2 pb-8">
        {list === 'offline' ? (
          <ServerOfflineNotice />
        ) : list && list.length === 0 ? (
          <p className="py-8 text-center text-body-2 text-fg-muted">{t('suggest.none')}</p>
        ) : (
          (list ?? []).map((s) => (
            <article key={s.id} className="flex flex-col gap-2 rounded-card border border-line p-3">
              <span className="tabular text-caption text-fg-muted">
                {s.author} · {date(s.createdAt)}
              </span>
              <p className="text-body-2">{s.body}</p>
              {s.hasImage && (
                <img
                  src={`/api/admin/suggestions/${s.id}/image`}
                  alt={t('suggest.withImage')}
                  className="max-h-64 self-start rounded-btn border border-line object-contain"
                />
              )}
              <div className="flex gap-2">
                {(['new', 'read', 'done'] as const).map((st) => (
                  <Chip
                    key={st}
                    selected={s.status === st}
                    onClick={() => void update(s, { status: st })}
                  >
                    {t(`suggest.status.${st}`)}
                  </Chip>
                ))}
              </div>
              {s.reply && (
                <p className="rounded-btn bg-primary-weak px-3 py-2 text-caption">
                  <strong className="text-primary">{t('suggest.reply')}</strong> {s.reply}
                </p>
              )}
              <textarea
                aria-label={t('suggest.replyLabel')}
                value={drafts[s.id] ?? ''}
                maxLength={2000}
                rows={2}
                placeholder={t('suggest.replyLabel')}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                className="rounded-btn border border-line bg-bg-subtle px-3 py-2 text-body-2 outline-none focus:border-primary"
              />
              <Button
                size="sm"
                disabled={!(drafts[s.id] ?? '').trim()}
                onClick={() =>
                  void update(s, { status: 'done', reply: (drafts[s.id] ?? '').trim() }).then(() =>
                    setDrafts((d) => ({ ...d, [s.id]: '' })),
                  )
                }
              >
                {t('suggest.sendReply')}
              </Button>
            </article>
          ))
        )}
      </div>
    </>
  );
}
