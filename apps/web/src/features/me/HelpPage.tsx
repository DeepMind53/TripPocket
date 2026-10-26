import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from '../../i18n';
import { TopBar } from '../../shared/ui';
import { HELP } from '../legal/content.ko';
import { IntroCarousel } from './IntroCarousel';

/** 2026-10-26 정식이 된 손동작 등, 소개 카드에 없는 쓰는 법 */
const TIPS = [
  'longPress',
  'swipeDay',
  'pullSync',
  'mapFull',
  'sheetResize',
  'offline',
  'pinned',
  'trash',
  'alerts',
] as const;

/**
 * 홈 로고 옆·마이 → [도움말] (사용자 요청 2026-10-26): 로그인 화면의 앱 소개 + 알아 두면 편한 기능 + 자주 묻는 질문
 */
export function HelpPage() {
  const { t } = useTranslation();
  return (
    <>
      <TopBar title={t('help.title')} backTo="/" />
      <div className="flex flex-col gap-6 px-5 pt-2 pb-8">
        <IntroCarousel />
        <section className="flex flex-col gap-2">
          <h2 className="text-body-1 font-semibold">{t('help.tipsTitle')}</h2>
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
            {TIPS.map((k) => (
              <li key={k} className="px-4 py-3 text-body-2">
                {t(`help.tips.${k}`)}
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-body-1 font-semibold">{t('help.faqTitle')}</h2>
          {HELP.map((s) => (
            <details key={s.title} className="rounded-card border border-line bg-surface px-4 py-3">
              <summary className="cursor-pointer text-body-2 font-semibold">{s.title}</summary>
              {s.body.map((p) => (
                <p key={p} className="mt-2 text-body-2 text-fg-sub">
                  {p}
                </p>
              ))}
            </details>
          ))}
        </section>
        <Link
          to="/me/suggestions"
          className="flex items-center justify-between gap-2 rounded-card bg-bg-subtle px-4 py-3"
        >
          <span className="flex flex-col">
            <span className="text-body-2 font-semibold">{t('help.askTitle')}</span>
            <span className="text-caption text-fg-muted">{t('help.askDesc')}</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
        </Link>
      </div>
    </>
  );
}
