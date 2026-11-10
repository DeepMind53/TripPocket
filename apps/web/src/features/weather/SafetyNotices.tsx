import { useSettings } from '../../data/settingsStore';
import { InlineIcon } from '../../shared/ui/InlineIcon';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../data/api/client';
import { useTranslation } from '../../i18n';

interface Notice {
  title: string;
  date: string;
  url?: string;
}

/**
 * 실험실 "외교부 안전공지" (docs/26 A2, 2026-11-03): 여행 나라마다 외교부 최신 안전공지 (최대 3개).
 * 나라 코드만 보낸다. 공지 원문은 외교부 해외안전여행에서
 */
export function SafetyNotices({ countries }: { countries: readonly string[] }) {
  const on = useSettings((s) => s.safetyNotice);
  const key = [...new Set(countries.filter((c) => c !== 'KR'))].sort().join(',');
  if (!on || !key) return null;
  return <List key={key} codes={key.split(',')} />;
}

function List({ codes }: { codes: string[] }) {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<(Notice & { cc: string })[] | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all(
      codes.map((cc) =>
        api<{ notices: Notice[] }>(`/api/info/safety/${cc}`).then((r) =>
          r.ok ? r.data.notices.map((n) => ({ ...n, cc })) : [],
        ),
      ),
    ).then((all) => alive && setNotices(all.flat()));
    return () => {
      alive = false;
    };
  }, [codes]);
  if (!notices?.length) return null;
  return (
    <section aria-label={t('safetyNotice.title')} className="flex flex-col gap-1.5">
      <h3 className="text-caption font-semibold text-fg-muted">
        <InlineIcon icon={ShieldAlert} />
        {t('safetyNotice.title')}
      </h3>
      <ul className="flex flex-col gap-1">
        {notices.map((n) => (
          <li
            key={`${n.cc}|${n.title}`}
            className="rounded-btn bg-bg-subtle px-3 py-2 text-caption"
          >
            <a
              href={n.url ?? 'https://www.0404.go.kr'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col"
            >
              <span className="font-semibold text-fg">{n.title}</span>
              <span className="tabular text-micro text-fg-muted">
                {n.date} · {t('safetyNotice.source')}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
