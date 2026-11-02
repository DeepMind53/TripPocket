import {
  ALLERGEN_KO,
  googleTranslateUrl,
  healthCardText,
  papagoUrl,
  type PhraseLang,
} from '@trippocket/shared';
import { ExternalLink, HeartPulse } from 'lucide-react';
import { useState } from 'react';
import { useTravelProfile } from '../../data/travelProfile';
import { useTranslation } from '../../i18n';
import { ShowCard } from './ShowCard';

/**
 * 회화 화면의 "알레르기·건강 카드" (사용자 요청 2026-11-02): 마이 → 개인정보의 알레르기·혈액형·복용약을
 * 고른 언어로 크게 보여 준다. 직접 적은 약·음식 이름은 번역하지 않고 번역기 바로가기로 넘긴다
 */
export function HealthCardButton({ lang }: { lang: PhraseLang }) {
  const { t } = useTranslation();
  const p = useTravelProfile();
  const [open, setOpen] = useState(false);
  const extra = [p.food.trim(), p.meds.trim()].filter(Boolean).join('\n');
  if (p.allergens.length === 0 && !p.bloodType && !extra) return null;
  const card = healthCardText(lang.code, p);
  const ko = healthCardText('ko', p);
  const translate = papagoUrl(lang, extra) ?? googleTranslateUrl(lang, extra);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 items-center gap-3 rounded-card border border-danger/40 bg-danger/5 px-4 py-3 text-left"
      >
        <HeartPulse aria-hidden="true" className="size-5 shrink-0 text-danger" />
        <span className="flex min-w-0 flex-col">
          <span className="text-body-2 font-semibold">{t('phrases.health')}</span>
          <span className="truncate text-caption text-fg-sub">
            {[p.allergens.map((a) => ALLERGEN_KO[a]).join(', '), p.bloodType]
              .filter(Boolean)
              .join(' · ') || t('phrases.healthSub')}
          </span>
        </span>
      </button>
      <ShowCard
        open={open}
        onClose={() => setOpen(false)}
        big={[card.allergy, card.blood].filter(Boolean).join('\n') || card.medsLabel}
        sub={[ko.allergy, ko.blood].filter(Boolean).join('\n')}
      >
        {extra && (
          <div className="flex flex-col gap-1 text-body-2">
            <span className="text-caption text-fg-muted">{`${card.medsLabel} · ${t('phrases.healthExtra')}`}</span>
            <span className="whitespace-pre-line">{extra}</span>
            <a
              href={translate}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-caption font-semibold text-primary"
            >
              {t('phrases.healthTranslate')}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        )}
        <p className="text-micro text-fg-muted">{t('phrases.healthNote')}</p>
      </ShowCard>
    </>
  );
}
