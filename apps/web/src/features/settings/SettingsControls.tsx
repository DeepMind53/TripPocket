import { useContext, useState, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button, Switch } from '../../shared/ui';
import { FeaturePreview } from '../common/FeaturePreview';
import type { PreviewId } from '../common/previewIds';
import { SettingsPageTitle } from './settingsPageTitle';

/** 상자 제목 줄 (화면 제목과 같으면 읽기 프로그램에만) */
export function GroupTitle({ title }: { title: string }) {
  const same = useContext(SettingsPageTitle) === title;
  return (
    <h2 className={same ? 'sr-only' : 'px-1 text-caption font-semibold text-fg-muted'}>{title}</h2>
  );
}

/** 설정 묶음 상자 · 이름 붙은 칸 · 스위치 한 줄 (설정 묶음 화면들이 함께 쓴다) */
export function Group({
  title,
  onReset,
  children,
}: {
  title: string;
  onReset?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <GroupTitle title={title} />
      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-4">
        {children}
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="self-end px-1 py-1 text-caption font-semibold text-fg-sub"
        >
          {t('settings.reset')}
        </button>
      )}
    </section>
  );
}

export function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-body-2 font-medium">{label}</span>
        {value && <span className="text-caption font-semibold text-primary">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function SwitchRow({
  label,
  checked,
  onChange,
  preview,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** 있으면 [샘플] — 켜면 어떻게 보이는지 미리보기 */
  preview?: PreviewId;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 tight:flex-wrap">
      <span className="min-w-0 flex-1 text-body-2 font-medium tight:basis-full">{label}</span>
      {preview && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen(true)}
          aria-label={t('labs.previewOf', { name: label })}
        >
          {t('labs.preview')}
        </Button>
      )}
      <Switch label={label} checked={checked} onCheckedChange={onChange} />
      {preview && (
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title={t('labs.previewOf', { name: label })}
        >
          <div className="flex flex-col gap-3 pb-2">
            <FeaturePreview id={preview} />
            <Button
              fullWidth
              variant={checked ? 'secondary' : 'primary'}
              onClick={() => {
                onChange(!checked);
                setOpen(false);
              }}
            >
              {checked ? t('labs.turnOff') : t('labs.turnOn')}
            </Button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
