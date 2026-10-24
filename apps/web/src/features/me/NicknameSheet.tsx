import { NICKNAME_MAX, normalizeNickname } from '@trippocket/shared';
import { useState } from 'react';
import { updateNickname, useAuth } from '../../data/authStore';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button, toast } from '../../shared/ui';

/**
 * 닉네임 정하기·바꾸기. 공유한 여행의 멤버 목록·관리자 화면에서 서로를 알아보는 이름.
 * - 처음 로그인하면(서버 nicknameSet = false) App이 띄운다 — 로그인 서비스 이름을 미리 채워 둠
 * - 마이 → 계정 카드의 [닉네임 바꾸기]
 */
export function NicknameSheet({
  open,
  onOpenChange,
  first = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 처음 정하기 (안내 문구가 다름) */
  first?: boolean;
}) {
  const { t } = useTranslation();
  const current = useAuth((s) => s.me?.nickname ?? '');
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const valid = normalizeNickname(value) !== null;

  async function save() {
    const nickname = normalizeNickname(value);
    if (!nickname) return;
    setBusy(true);
    const ok = await updateNickname(nickname);
    setBusy(false);
    if (!ok) return toast(t('nickname.failed'));
    toast(t('nickname.saved'));
    onOpenChange(false);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(first ? 'nickname.firstTitle' : 'nickname.title')}
      description={t('nickname.desc')}
      footer={
        <Button size="lg" fullWidth loading={busy} disabled={!valid} onClick={() => void save()}>
          {t('form.save')}
        </Button>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="nickname" className="text-caption font-semibold text-fg-sub">
          {t('nickname.label')}
        </label>
        <input
          id="nickname"
          value={value}
          maxLength={NICKNAME_MAX * 2}
          autoComplete="nickname"
          onChange={(e) => setValue(e.currentTarget.value)}
          className="h-12 w-full rounded-btn bg-bg-subtle px-3 text-body-1"
        />
        <p className="text-caption text-fg-muted">{t('nickname.hint', { max: NICKNAME_MAX })}</p>
      </form>
    </BottomSheet>
  );
}
