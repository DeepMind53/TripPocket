import { FlaskConical } from 'lucide-react';
import { LABS, setLab, useLab, type LabId } from '../../data/labsStore';
import { useTranslation } from '../../i18n';
import { Switch, TopBar } from '../../shared/ui';

/** 마이 → 실험실: 정식 기능 전에 시험해 보는 기능 켜기/끄기 (이 기기에만 저장) */
export function LabsPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('labs.title')} backTo="/me" />
      <div className="flex flex-col gap-4 px-5 pt-2">
        <p className="flex items-start gap-2 rounded-card bg-bg-subtle p-3 text-caption text-fg-sub">
          <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          {t('labs.desc')}
        </p>
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
          {LABS.map((id) => (
            <LabRow key={id} id={id} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function LabRow({ id }: { id: LabId }) {
  const { t } = useTranslation();
  const on = useLab(id);
  const inputId = `lab-${id}`;
  return (
    <li className="flex items-center gap-3 bg-surface px-4 py-3">
      <label htmlFor={inputId} className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-2 font-medium">{t(`labs.item.${id}.name`)}</span>
        <span className="text-caption text-fg-muted">{t(`labs.item.${id}.desc`)}</span>
      </label>
      <Switch id={inputId} checked={on} onCheckedChange={(v) => setLab(id, v)} />
    </li>
  );
}
