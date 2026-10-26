import { FlaskConical, TestTube2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../data/authStore';
import { LABS, setLab, useLab, type LabId } from '../../data/labsStore';
import { useTranslation } from '../../i18n';
import { Button, Switch, toast, TopBar } from '../../shared/ui';

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
        <SampleTest />
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

/**
 * 관리자만: 오늘 출발 도쿄 5일 샘플(항공·숙소·일정) + 지난 여행·저장 장소를 만들고 실험실을 모두 켠다
 * (사용자 요청 2026-10-26 — 여행 당일에만 보이는 화면 점검용). 샘플 코드는 누를 때만 불러온다
 */
function SampleTest() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAdmin = useAuth((s) => s.status === 'user' && s.me?.isAdmin === true);
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return null;
  return (
    <section aria-label={t('labs.sample.title')} className="flex flex-col gap-2 pt-2">
      <h2 className="text-caption font-bold text-fg-muted">{t('labs.sample.title')}</h2>
      <p className="text-caption text-fg-muted">{t('labs.sample.desc')}</p>
      <Button
        fullWidth
        disabled={busy}
        leading={<TestTube2 aria-hidden="true" className="size-[18px]" />}
        onClick={() => {
          setBusy(true);
          void import('../../data/labSample')
            .then((m) => m.createLabSample())
            .then((id) => {
              toast(t('labs.sample.created'));
              void navigate(`/trips/${id}/plan`);
            })
            .finally(() => setBusy(false));
        }}
      >
        {t('labs.sample.create')}
      </Button>
      <Button
        variant="ghost"
        fullWidth
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void import('../../data/labSample')
            .then((m) => m.removeLabSample())
            .then((n) => toast(t('labs.sample.removed', { n })))
            .finally(() => setBusy(false));
        }}
      >
        {t('labs.sample.remove')}
      </Button>
    </section>
  );
}
