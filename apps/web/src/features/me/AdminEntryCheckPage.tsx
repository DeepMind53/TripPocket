import { useEffect, useState } from 'react';
import { api } from '../../data/api/client';
import { useTranslation } from '../../i18n';
import { Spinner, TopBar } from '../../shared/ui';

interface Check {
  country: string;
  code: string;
  app: number | null;
  official: number | null;
  text: string;
  match: boolean | null;
}

/**
 * 관리자 "입국 정보 점검" (docs/26 A1, 2026-11-03): 앱에 담은 무비자 기간 ↔ 외교부 입국허가요건.
 * 다른 나라만 위로. 고치는 것은 사람이 (공식 확인 뒤 essentials.ts) — 틀린 값이 자동으로 나가지 않게
 */
export function AdminEntryCheckPage() {
  const { t } = useTranslation();
  const [checks, setChecks] = useState<Check[] | null | undefined>(undefined);
  useEffect(() => {
    void api<{ checks: Check[] }>('/api/admin/entry-check').then((r) =>
      setChecks(r.ok ? r.data.checks : null),
    );
  }, []);
  const sorted = checks
    ? [...checks].sort((a, b) => Number(a.match ?? 2) - Number(b.match ?? 2))
    : [];
  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar title={t('entryCheck.title')} backTo="/me" />
      <div className="flex flex-col gap-3 px-5 pt-2">
        <p className="text-caption whitespace-pre-line text-fg-muted">{t('entryCheck.desc')}</p>
        {checks === undefined ? (
          <Spinner />
        ) : checks === null ? (
          <p className="rounded-card bg-bg-subtle p-4 text-body-2 whitespace-pre-line text-fg-sub">
            {t('entryCheck.unavailable')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
            {sorted.map((c) => (
              <li key={c.code} className="flex items-center gap-2 bg-surface px-4 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-2 font-medium">{c.country}</span>
                  <span className="tabular text-caption text-fg-muted">
                    {t('entryCheck.values', {
                      app: c.app ?? '-',
                      official: c.text || '-',
                    })}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-caption font-bold ${
                    c.match === false ? 'text-danger' : c.match ? 'text-primary' : 'text-fg-muted'
                  }`}
                >
                  {t(
                    c.match === false
                      ? 'entryCheck.diff'
                      : c.match
                        ? 'entryCheck.same'
                        : 'entryCheck.unknown',
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
