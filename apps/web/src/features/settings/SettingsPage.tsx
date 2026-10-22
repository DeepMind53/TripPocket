import { useTranslation } from 'react-i18next';
import { EmptyState, TopBar } from '../../shared/ui';

/** S-23 설정 — 10단계에서 항목이 들어온다 (docs/12 §3) */
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto min-h-dvh max-w-[560px]">
      <TopBar title={t('settings.title')} backTo="/me" />
      <EmptyState
        emoji="⚙️"
        title={t('settings.title')}
        note={t('common.comingInStep', { step: 10 })}
      />
    </div>
  );
}
