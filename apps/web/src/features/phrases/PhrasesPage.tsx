import {
  googleTranslateUrl,
  KO_PHRASES,
  PHRASE_IDS,
  PHRASE_LANGS,
  papagoUrl,
  phraseLangFor,
  type PhraseId,
} from '@trippocket/shared';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTrip } from '../../data/hooks';
import { useTranslation } from '../../i18n';
import { Chip, ScrollRow, TopBar } from '../../shared/ui';
import { ShowCard } from './ShowCard';

/**
 * 번역·회화 (docs/20 G7): 여행지 말로 자주 쓰는 10문장 — 누르면 크게 보여 주기.
 * 그 밖의 말은 파파고·Google 번역 앱으로 (무료, 바로가기만)
 */
export function PhrasesPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const trip = useTrip(params.get('trip') ?? '');
  const tripLang = phraseLangFor(
    trip?.destinations.find((d) => d.countryCode && d.countryCode !== 'KR')?.countryCode,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const lang = PHRASE_LANGS.find((l) => l.code === (picked ?? tripLang?.code ?? 'en'))!;
  const [show, setShow] = useState<PhraseId | null>(null);
  const papago = papagoUrl(lang);

  return (
    <>
      <TopBar title={t('phrases.title')} backTo={trip ? `/trips/${trip.id}/plan` : '/'} />
      <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
        <ScrollRow
          role="radiogroup"
          aria-label={t('phrases.lang')}
          className="flex gap-2 pt-1.5 pb-1"
        >
          {PHRASE_LANGS.map((l) => (
            <Chip
              key={l.code}
              role="radio"
              aria-checked={l.code === lang.code}
              selected={l.code === lang.code}
              onClick={() => setPicked(l.code)}
            >
              {l.name}
            </Chip>
          ))}
        </ScrollRow>

        <div className="grid grid-cols-2 gap-2">
          {papago && (
            <a
              href={papago}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center gap-1.5 rounded-card bg-bg-subtle text-body-2 font-semibold"
            >
              {t('phrases.papago')}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          )}
          <a
            href={googleTranslateUrl(lang)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex h-12 items-center justify-center gap-1.5 rounded-card bg-bg-subtle text-body-2 font-semibold ${papago ? '' : 'col-span-2'}`}
          >
            {t('phrases.google')}
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </div>

        <ul
          aria-label={t('phrases.list', { lang: lang.name })}
          className="flex flex-col divide-y divide-line rounded-card border border-line"
        >
          {PHRASE_IDS.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setShow(id)}
                className="flex w-full flex-col gap-0.5 px-4 py-3 text-left active:bg-bg-subtle"
              >
                <span className="text-caption text-fg-muted">{KO_PHRASES[id]}</span>
                <span className="text-title-2">{lang.phrases[id]}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-caption text-fg-muted">{t('phrases.hint')}</p>
      </div>
      <ShowCard
        open={show !== null}
        onClose={() => setShow(null)}
        big={show ? lang.phrases[show] : ''}
        sub={show ? KO_PHRASES[show] : undefined}
      />
    </>
  );
}
