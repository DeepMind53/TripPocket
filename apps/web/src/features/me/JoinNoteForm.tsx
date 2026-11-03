import { useState } from 'react';
import { api } from '../../data/api/client';
import { useTranslation } from '../../i18n';
import { Button, toast } from '../../shared/ui';

const inputClass =
  'w-full min-w-0 rounded-btn border border-line bg-surface px-3 text-body-2 outline-none focus:border-primary';

/**
 * 가입 승인 대기 화면 (사용자 요청 2026-11-03): 닉네임 고치기 + 관리자에게 전할 말 (누구인지).
 * 로그인 전이라 콜백이 준 1회용 토큰(30분)으로만 보낸다. 말은 승인·거절하면 서버에서 지운다
 */
export function JoinNoteForm({ token }: { token: string }) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'expired'>('idle');
  if (state === 'sent')
    return (
      <p className="text-body-2 whitespace-pre-line text-fg-sub">{t('login.joinNote.sent')}</p>
    );
  if (state === 'expired')
    return (
      <p className="text-body-2 text-fg-sub whitespace-pre-line">{t('login.joinNote.expired')}</p>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setState('busy');
        void api<{ ok: true }>('/auth/join-note', {
          method: 'POST',
          body: JSON.stringify({
            token,
            note,
            ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
          }),
        }).then((res) => {
          if (res.ok) {
            setState('sent');
            toast(t('login.joinNote.sent'));
          } else setState(res.status === 404 ? 'expired' : 'idle');
        });
      }}
    >
      <label className="flex flex-col gap-1 text-caption font-semibold text-fg-sub">
        {t('login.joinNote.nickname')}
        <input
          value={nickname}
          maxLength={40}
          placeholder={t('login.joinNote.nicknamePlaceholder')}
          onChange={(e) => setNickname(e.target.value)}
          className={`${inputClass} h-11`}
        />
      </label>
      <label className="flex flex-col gap-1 text-caption font-semibold text-fg-sub">
        {t('login.joinNote.note')}
        <textarea
          value={note}
          maxLength={200}
          rows={3}
          required
          placeholder={t('login.joinNote.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
          className={`${inputClass} py-2`}
        />
      </label>
      <p className="text-caption whitespace-pre-line text-fg-muted">
        {t('login.joinNote.privacy')}
      </p>
      <Button type="submit" fullWidth loading={state === 'busy'} disabled={!note.trim()}>
        {t('login.joinNote.send')}
      </Button>
    </form>
  );
}
