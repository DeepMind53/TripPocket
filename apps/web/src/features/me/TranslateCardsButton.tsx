import { Languages } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../data/api/client';
import { updateTravelProfile, useTravelProfile } from '../../data/travelProfile';
import { useTranslation } from '../../i18n';
import { Button, toast } from '../../shared/ui';

/**
 * 직접 추가한 음식·복용약을 건강 카드용으로 번역 (사용자 결정 2026-11-02: 무료 AI로 먼저, 안 되면 번역기 바로가기).
 * 누를 때만 이름을 서버 → 무료 AI로 보내고, 받은 번역은 이 기기에만 남긴다
 */
export function TranslateCardsButton() {
  const { t } = useTranslation();
  const p = useTravelProfile();
  const [busy, setBusy] = useState(false);
  const foods = p.customFoods;
  const meds = p.meds.trim();
  const missing =
    foods.filter((c) => !c.tr).length + (meds && !Object.keys(p.medsTr).length ? 1 : 0);
  if (foods.length === 0 && !meds) return null;

  async function run() {
    setBusy(true);
    const terms = [
      ...foods.map((c, i) => ({ id: `f${i}`, ko: c.ko, en: c.en })),
      ...(meds ? [{ id: 'm', ko: meds.slice(0, 40), en: '' }] : []),
    ];
    const res = await api<{ translations: Record<string, Record<string, string>> }>(
      '/api/translate/terms',
      { method: 'POST', body: JSON.stringify({ terms }) },
    );
    setBusy(false);
    if (!res.ok) {
      toast(t('profile.translateFailed'));
      return;
    }
    const tr = res.data.translations;
    updateTravelProfile({
      customFoods: foods.map((c, i) => (tr[`f${i}`] ? { ...c, tr: tr[`f${i}`] } : c)),
      ...(tr.m ? { medsTr: tr.m } : {}),
    });
    toast(t('profile.translated'));
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-card bg-bg-subtle p-3">
      <Button variant="secondary" loading={busy} onClick={() => void run()}>
        <Languages aria-hidden="true" className="size-4" />
        {missing > 0 ? t('profile.translateN', { n: missing }) : t('profile.translateAgain')}
      </Button>
      <p className="text-micro whitespace-pre-line text-fg-muted">{t('profile.translateNote')}</p>
    </div>
  );
}
