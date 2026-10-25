import { ImagePlus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { suggestionsApi, type Suggestion } from '../../data/api/suggestions';
import { useTranslation } from '../../i18n';
import { Button, IconButton, toast, TopBar } from '../../shared/ui';
import { ServerOfflineNotice } from '../common/ServerOfflineNotice';

const date = (iso: string) => iso.slice(0, 10).replaceAll('-', '.');

/** 마이 → 개선 제안 (사용자 요청 2026-10-25): 글 + 사진 1장(10MB) → 관리자에게, 답장 보기 */
export function SuggestionsPage() {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Suggestion[] | null | 'offline'>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = () =>
    void suggestionsApi.mine().then((r) => setList(r.ok ? r.data.suggestions : 'offline'));
  useEffect(load, []);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    const r = await suggestionsApi.send(body.trim(), image ?? undefined);
    setBusy(false);
    if (r !== 'ok') return toast(t(`suggest.${r}`));
    setBody('');
    setImage(null);
    toast(t('suggest.sent'));
    load();
  }

  return (
    <>
      <TopBar title={t('suggest.title')} backTo="/me" />
      <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
        <p className="text-caption text-fg-muted">{t('suggest.desc')}</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-body-2 font-medium">{t('suggest.body')}</span>
          <textarea
            value={body}
            maxLength={2000}
            rows={5}
            placeholder={t('suggest.placeholder')}
            onChange={(e) => setBody(e.target.value)}
            className="rounded-btn border border-line bg-bg-subtle px-3 py-2 text-body-2 outline-none focus:border-primary"
          />
        </label>
        <input
          ref={input}
          type="file"
          accept="image/*"
          aria-label={t('suggest.addImage')}
          className="sr-only"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0] ?? null;
            e.currentTarget.value = '';
            if (f && f.size > 10 * 1024 * 1024) return toast(t('suggest.too_large'));
            setImage(f);
          }}
        />
        {image ? (
          <div className="flex min-h-11 items-center gap-2 rounded-card border border-line pl-3">
            <ImagePlus aria-hidden="true" className="size-4 text-primary" />
            <span className="min-w-0 flex-1 truncate text-body-2">{image.name}</span>
            <IconButton
              label={t('suggest.removeImage')}
              icon={<X />}
              onClick={() => setImage(null)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-card border border-dashed border-line text-caption font-semibold text-primary"
          >
            <ImagePlus aria-hidden="true" className="size-4" />
            {t('suggest.addImage')}
          </button>
        )}
        <Button
          size="lg"
          fullWidth
          loading={busy}
          disabled={!body.trim()}
          onClick={() => void send()}
        >
          {t('suggest.send')}
        </Button>

        <section aria-label={t('suggest.mine')} className="flex flex-col gap-2 pt-2">
          <h2 className="text-caption font-bold text-fg-muted">{t('suggest.mine')}</h2>
          {list === 'offline' ? (
            <ServerOfflineNotice inline />
          ) : list && list.length === 0 ? (
            <p className="text-caption text-fg-muted">{t('suggest.none')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
              {(list ?? []).map((s) => (
                <li key={s.id} className="flex items-start gap-2 py-2.5 pr-1 pl-4">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="tabular text-caption text-fg-muted">
                      {date(s.createdAt)} · {t(`suggest.status.${s.status}`)}
                      {s.hasImage && ` · ${t('suggest.withImage')}`}
                    </span>
                    <span className="text-body-2">{s.body}</span>
                    {s.reply && (
                      <span className="rounded-btn bg-primary-weak px-3 py-2 text-caption text-fg">
                        <strong className="text-primary">{t('suggest.reply')}</strong> {s.reply}
                      </span>
                    )}
                  </span>
                  <IconButton
                    label={t('suggest.delete')}
                    icon={<Trash2 />}
                    onClick={() => void suggestionsApi.remove(s.id).then(load)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
