import { useParams } from 'react-router';
import { useTranslation } from '../../i18n';
import { TopBar } from '../../shared/ui';
import { DATA_SOURCES, HELP, PRIVACY, TERMS, UPDATED, type Section } from './content.ko';
import licenses from './licenses.json';

type Doc = 'privacy' | 'terms' | 'licenses' | 'help';

/** 개인정보처리방침·이용약관·오픈소스 라이선스·도움말 (23단계, docs/09 §7.6) */
export function LegalPage() {
  const { t } = useTranslation();
  const { doc = 'help' } = useParams();
  const kind = (['privacy', 'terms', 'licenses', 'help'] as const).includes(doc as Doc)
    ? (doc as Doc)
    : 'help';

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t(`legal.${kind}`)} backTo="/me" />
      <article className="flex flex-col gap-5 px-5 pt-2 text-body-2">
        {kind === 'privacy' && <Sections list={PRIVACY} />}
        {kind === 'terms' && <Sections list={TERMS} />}
        {kind === 'help' && <Sections list={HELP} />}
        {kind === 'licenses' && (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="text-body-1 font-bold">{t('legal.dataSources')}</h2>
              <ul className="flex flex-col divide-y divide-line">
                {DATA_SOURCES.map((d) => (
                  <li key={d.name} className="flex flex-col py-2">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary"
                    >
                      {d.name}
                    </a>
                    <span className="text-caption text-fg-sub">
                      {d.use} · {d.license}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="text-body-1 font-bold">
                {t('legal.software', { n: licenses.length })}
              </h2>
              <ul className="flex flex-col divide-y divide-line">
                {licenses.map((l) => (
                  <li key={l.name} className="flex items-baseline justify-between gap-2 py-1.5">
                    <span className="min-w-0 truncate">
                      {l.name} <span className="text-caption text-fg-muted">{l.version}</span>
                    </span>
                    <span className="shrink-0 text-caption text-fg-sub">{l.license}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        {kind !== 'help' && kind !== 'licenses' && (
          <p className="text-caption text-fg-muted">{t('legal.updated', { date: UPDATED })}</p>
        )}
      </article>
    </div>
  );
}

function Sections({ list }: { list: Section[] }) {
  return (
    <>
      {list.map((s) => (
        <section key={s.title} className="flex flex-col gap-1.5">
          <h2 className="text-body-1 font-bold">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p} className="text-fg-sub">
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}
