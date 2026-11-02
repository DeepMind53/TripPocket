import {
  ALLERGEN_KO,
  googleTranslateUrl,
  healthCardText,
  papagoUrl,
  type PhraseLang,
} from '@trippocket/shared';
import { Ban, Droplet, ExternalLink, HeartPulse, Pill } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTravelProfile } from '../../data/travelProfile';
import { useTranslation } from '../../i18n';
import { ShowCard } from './ShowCard';

type Kind = 'allergy' | 'dislike' | 'blood' | 'meds';

/**
 * 회화 화면의 건강 카드 (사용자 요청 2026-11-02): 마이 → 개인정보의 알레르기·혈액형·복용약을
 * 카드 하나씩 따로 고른 언어로 크게 보여 주고, 영어를 함께 적는다.
 * 직접 적은 약·음식 이름은 번역하지 않고 번역기 바로가기로 넘긴다
 */
export function HealthCardButton({ lang }: { lang: PhraseLang }) {
  const { t } = useTranslation();
  const p = useTravelProfile();
  const [open, setOpen] = useState<Kind | null>(null);
  const extra = p.meds.trim();
  const input = { allergens: p.allergens, custom: p.customFoods, bloodType: p.bloodType };
  const local = healthCardText(lang.code, input);
  const en = healthCardText('en', input);
  const ko = healthCardText('ko', input);
  const own = (kind: 'allergy' | 'dislike') =>
    p.customFoods.filter((c) => c.kind === kind).map((c) => c.ko || c.en);
  const withEn = lang.code !== 'en';
  const cards: { kind: Kind; icon: ReactNode; title: string; preview: string }[] = [
    ...(local.allergy
      ? [
          {
            kind: 'allergy' as const,
            icon: <HeartPulse aria-hidden="true" className="size-5 shrink-0 text-danger" />,
            title: t('phrases.cardAllergy'),
            preview: [...p.allergens.map((a) => ALLERGEN_KO[a]), ...own('allergy')].join(', '),
          },
        ]
      : []),
    ...(local.dislike
      ? [
          {
            kind: 'dislike' as const,
            icon: <Ban aria-hidden="true" className="size-5 shrink-0 text-danger" />,
            title: t('phrases.cardDislike'),
            preview: own('dislike').join(', '),
          },
        ]
      : []),
    ...(local.blood
      ? [
          {
            kind: 'blood' as const,
            icon: <Droplet aria-hidden="true" className="size-5 shrink-0 text-danger" />,
            title: t('phrases.cardBlood'),
            preview: p.bloodType ?? '',
          },
        ]
      : []),
    ...(extra
      ? [
          {
            kind: 'meds' as const,
            icon: <Pill aria-hidden="true" className="size-5 shrink-0 text-danger" />,
            title: t('phrases.cardMeds'),
            preview: extra.replace(/\n/g, ' · '),
          },
        ]
      : []),
  ];
  if (cards.length === 0) return null;
  const translate = papagoUrl(lang, extra) ?? googleTranslateUrl(lang, extra);
  const show = {
    allergy: { big: local.allergy, en: en.allergy, ko: ko.allergy },
    dislike: { big: local.dislike, en: en.dislike, ko: ko.dislike },
    blood: { big: local.blood ?? '', en: en.blood ?? '', ko: ko.blood ?? '' },
    meds: { big: extra, en: '', ko: `${ko.medsLabel} · ${t('phrases.healthExtra')}` },
  };
  const cur = open ? show[open] : null;
  return (
    <section aria-label={t('phrases.health')} className="flex flex-col gap-2">
      <h2 className="text-caption font-bold text-fg-muted">{t('phrases.health')}</h2>
      <ul className="flex flex-col gap-2">
        {cards.map((c) => (
          <li key={c.kind}>
            <button
              type="button"
              onClick={() => setOpen(c.kind)}
              className="flex min-h-14 w-full items-center gap-3 rounded-card border border-danger/40 bg-danger/5 px-4 py-3 text-left"
            >
              {c.icon}
              <span className="flex min-w-0 flex-col">
                <span className="text-body-2 font-semibold">{c.title}</span>
                <span className="truncate text-caption text-fg-sub">{c.preview}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ShowCard
        open={open !== null}
        onClose={() => setOpen(null)}
        big={cur?.big ?? ''}
        {...(withEn && cur?.en ? { en: cur.en } : {})}
        sub={cur?.ko}
      >
        {open === 'meds' && (
          <a
            href={translate}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-caption font-semibold text-primary"
          >
            {t('phrases.healthTranslate')}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        )}
        <p className="text-micro text-fg-muted">{t('phrases.healthNote')}</p>
      </ShowCard>
    </section>
  );
}
