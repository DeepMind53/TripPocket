import { mergePlanSeen, nextPlanPrompt, type PlanFeature } from '@trippocket/shared';
import { useEffect, useState } from 'react';
import { currentSettings, updateSettings } from '../../data/settingsStore';
import { settingsConfirmed, syncSettings } from '../../data/settingsSync';
import { useTranslation } from '../../i18n';
import { BottomSheet, Button } from '../../shared/ui';
import { FeaturePreview } from '../common/FeaturePreview';
import { PLAN_LABELS } from '../settings/planLabels';
import { planPromptRun } from './planPromptRun';

/**
 * 접속할 때 아직 묻지 않은 일정 기능 하나를 샘플과 함께 묻는다 (사용자 요청 2026-11-02).
 * 물어본 기록은 계정 설정(planPromptSeen)에 남겨 사용자별·기능별로 한 번만.
 * 계정 설정을 받은 뒤에만 묻는다 — 받기 전에 물으면 다른 기기에서 본 기능을 또 묻게 된다
 */
export function PlanFeaturePrompt() {
  const { t } = useTranslation();
  const [feature, setFeature] = useState<PlanFeature | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (planPromptRun.asked) return;
    let alive = true;
    void syncSettings().then(() => {
      if (!alive || planPromptRun.asked || !settingsConfirmed()) return;
      const seen = currentSettings().planPromptSeen;
      const next = nextPlanPrompt(seen);
      planPromptRun.asked = true;
      if (!next) return;
      updateSettings({ planPromptSeen: mergePlanSeen(seen, [next]) });
      setFeature(next);
      setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!feature) return null;
  const answer = (on: boolean) => {
    updateSettings({ [feature]: on });
    setOpen(false);
  };
  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title={t('planPrompt.title', { name: t(PLAN_LABELS[feature]) })}
      footer={
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="secondary" onClick={() => answer(false)}>
              {t('planPrompt.off')}
            </Button>
            <Button size="lg" onClick={() => answer(true)}>
              {t('planPrompt.on')}
            </Button>
          </div>
          <p className="text-center text-micro text-fg-muted">{t('planPrompt.where')}</p>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <FeaturePreview id={feature} />
      </div>
    </BottomSheet>
  );
}
